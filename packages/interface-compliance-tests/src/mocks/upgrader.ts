import { mockConnection } from './connection.js'
import type { Libp2pEvents } from '@libp2p/interface'
import type { Connection, MultiaddrConnection } from '@libp2p/interface/connection'
import type { TypedEventTarget } from '@libp2p/interface/events'
import type { Upgrader, UpgraderOptions } from '@libp2p/interface/transport'
import type { Registrar } from '@libp2p/interface-internal/registrar'

export interface MockUpgraderInit {
  registrar?: Registrar
  events?: TypedEventTarget<Libp2pEvents>
}

class MockUpgrader implements Upgrader {
  private readonly registrar?: Registrar
  private readonly events?: TypedEventTarget<Libp2pEvents>

  constructor (init: MockUpgraderInit) {
    this.registrar = init.registrar
    this.events = init.events
  }

  async upgradeOutbound (multiaddrConnection: MultiaddrConnection, opts: UpgraderOptions = {}): Promise<Connection> {
    const connection = mockConnection(multiaddrConnection, {
      direction: 'outbound',
      registrar: this.registrar,
      ...opts
    })

    this.events?.safeDispatchEvent('connection:open', { detail: connection })

    return connection
  }

  async upgradeInbound (multiaddrConnection: MultiaddrConnection, opts: UpgraderOptions = {}): Promise<Connection> {
    const connection = mockConnection(multiaddrConnection, {
      direction: 'inbound',
      registrar: this.registrar,
      ...opts
    })

    this.events?.safeDispatchEvent('connection:open', { detail: connection })

    return connection
  }
}

export function mockUpgrader (init: MockUpgraderInit = {}): Upgrader {
  return new MockUpgrader(init)
}
