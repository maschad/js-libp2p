/* eslint-env mocha */

import { expect } from 'aegir/chai'
import sinon from 'sinon'
import { PingService, PingServiceInit } from '../../src/ping/index.js'
import Peers from '../fixtures/peers.js'
import { mockRegistrar, mockUpgrader, connectionPair } from '@libp2p/interface-mocks'
import { createFromJSON } from '@libp2p/peer-id-factory'
import { DefaultConnectionManager } from '../../src/connection-manager/index.js'
import { start, stop } from '@libp2p/interfaces/startable'
import { CustomEvent } from '@libp2p/interfaces/events'
import { TimeoutController } from 'timeout-abort-controller'
import delay from 'delay'
import { pipe } from 'it-pipe'
import { PersistentPeerStore } from '@libp2p/peer-store'
import { MemoryDatastore } from 'datastore-core'
import { DefaultComponents } from '../../src/components.js'

const defaultInit: PingServiceInit = {
  protocolPrefix: 'ipfs',
  maxInboundStreams: 1,
  maxOutboundStreams: 1,
  timeout: 1000
}

async function createComponents (index: number): Promise<DefaultComponents> {
  const peerId = await createFromJSON(Peers[index])

  const components = new DefaultComponents({
    peerId,
    registrar: mockRegistrar(),
    upgrader: mockUpgrader(),
    datastore: new MemoryDatastore()
  })
  components.peerStore = new PersistentPeerStore(components)
  components.connectionManager = new DefaultConnectionManager(components, {
    minConnections: 50,
    maxOutgoingConnections: 1000,
    maxIncomingConnections: 1000,
    autoDialInterval: 1000,
    inboundUpgradeTimeout: 1000
  })

  return components
}

describe('ping', () => {
  let localComponents: DefaultComponents
  let remoteComponents: DefaultComponents

  beforeEach(async () => {
    localComponents = await createComponents(0)
    remoteComponents = await createComponents(1)

    await Promise.all([
      start(localComponents),
      start(remoteComponents)
    ])
  })

  afterEach(async () => {
    sinon.restore()

    await Promise.all([
      stop(localComponents),
      stop(remoteComponents)
    ])
  })

  it('should be able to ping another peer', async () => {
    const localPing = new PingService(localComponents, defaultInit)
    const remotePing = new PingService(remoteComponents, defaultInit)

    await start(localPing)
    await start(remotePing)

    // simulate connection between nodes
    const [localToRemote, remoteToLocal] = connectionPair(localComponents, remoteComponents)
    localComponents.upgrader.dispatchEvent(new CustomEvent('connection', { detail: localToRemote }))
    remoteComponents.upgrader.dispatchEvent(new CustomEvent('connection', { detail: remoteToLocal }))

    // Run ping
    await expect(localPing.ping(remoteComponents.peerId)).to.eventually.be.gte(0)
  })

  it('should time out pinging another peer when waiting for a pong', async () => {
    const localPing = new PingService(localComponents, defaultInit)
    const remotePing = new PingService(remoteComponents, defaultInit)

    await start(localPing)
    await start(remotePing)

    // simulate connection between nodes
    const [localToRemote, remoteToLocal] = connectionPair(localComponents, remoteComponents)
    localComponents.upgrader.dispatchEvent(new CustomEvent('connection', { detail: localToRemote }))
    remoteComponents.upgrader.dispatchEvent(new CustomEvent('connection', { detail: remoteToLocal }))

    // replace existing handler with a really slow one
    await remoteComponents.registrar.unhandle(remotePing.protocol)
    await remoteComponents.registrar.handle(remotePing.protocol, ({ stream }) => {
      void pipe(
        stream,
        async function * (source) {
          for await (const chunk of source) {
            // longer than the timeout
            await delay(1000)

            yield chunk
          }
        },
        stream
      )
    })

    const newStreamSpy = sinon.spy(localToRemote, 'newStream')

    // 10 ms timeout
    const timeoutController = new TimeoutController(10)

    // Run ping, should time out
    await expect(localPing.ping(remoteComponents.peerId, {
      signal: timeoutController.signal
    }))
      .to.eventually.be.rejected.with.property('code', 'ABORT_ERR')

    // should have closed stream
    expect(newStreamSpy).to.have.property('callCount', 1)
    const stream = await newStreamSpy.getCall(0).returnValue
    expect(stream).to.have.nested.property('stat.timeline.close')
  })
})
