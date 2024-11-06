import { stop } from '@libp2p/interface'
import { expect } from 'aegir/chai'
import pDefer from 'p-defer'
import { createPeers } from './fixtures/create-peers.js'
import type { Echo } from '@libp2p/echo'
import type { Libp2p } from 'libp2p'

describe('events', () => {
  let dialer: Libp2p<{ echo: Echo }>
  let listener: Libp2p<{ echo: Echo }>

  afterEach(async () => {
    await stop(dialer, listener)
  })

  it('should emit connection events', async () => {
    ({ dialer, listener } = await createPeers())

    const localConnectionEventReceived = pDefer()
    const localConnectionEndEventReceived = pDefer()
    const localPeerConnectEventReceived = pDefer()
    const localPeerDisconnectEventReceived = pDefer()
    const remoteConnectionEventReceived = pDefer()
    const remoteConnectionEndEventReceived = pDefer()
    const remotePeerConnectEventReceived = pDefer()
    const remotePeerDisconnectEventReceived = pDefer()

    dialer.addEventListener('connection:open', (event) => {
      expect(event.detail.remotePeer.equals(listener.peerId)).to.be.true()
      localConnectionEventReceived.resolve()
    })
    dialer.addEventListener('connection:close', (event) => {
      expect(event.detail.remotePeer.equals(listener.peerId)).to.be.true()
      localConnectionEndEventReceived.resolve()
    })
    dialer.addEventListener('peer:connect', (event) => {
      expect(event.detail.equals(listener.peerId)).to.be.true()
      localPeerConnectEventReceived.resolve()
    })
    dialer.addEventListener('peer:disconnect', (event) => {
      expect(event.detail.equals(listener.peerId)).to.be.true()
      localPeerDisconnectEventReceived.resolve()
    })

    listener.addEventListener('connection:open', (event) => {
      expect(event.detail.remotePeer.equals(dialer.peerId)).to.be.true()
      remoteConnectionEventReceived.resolve()
    })
    listener.addEventListener('connection:close', (event) => {
      expect(event.detail.remotePeer.equals(dialer.peerId)).to.be.true()
      remoteConnectionEndEventReceived.resolve()
    })
    listener.addEventListener('peer:connect', (event) => {
      expect(event.detail.equals(dialer.peerId)).to.be.true()
      remotePeerConnectEventReceived.resolve()
    })
    listener.addEventListener('peer:disconnect', (event) => {
      expect(event.detail.equals(dialer.peerId)).to.be.true()
      remotePeerDisconnectEventReceived.resolve()
    })

    await dialer.dial(listener.getMultiaddrs())

    // Verify onConnection is called with the connection
    const connections = await Promise.all([
      ...dialer.getConnections(listener.peerId),
      ...listener.getConnections(dialer.peerId)
    ])
    expect(connections).to.have.lengthOf(2)

    await Promise.all([
      localConnectionEventReceived.promise,
      localPeerConnectEventReceived.promise,
      remoteConnectionEventReceived.promise,
      remotePeerConnectEventReceived.promise
    ])

    // Verify onConnectionEnd is called with the connection
    await Promise.all(connections.map(async conn => { await conn.close() }))

    await Promise.all([
      localConnectionEndEventReceived.promise,
      localPeerDisconnectEventReceived.promise,
      remoteConnectionEndEventReceived.promise,
      remotePeerDisconnectEventReceived.promise
    ])
  })
})
