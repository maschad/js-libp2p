/**
 * @packageDocumentation
 *
 * The {@link PerfService} implements the [perf protocol](https://github.com/libp2p/specs/blob/master/perf/perf.md), which can be used to measure transfer performance within and across libp2p implementations.
 *
 * @example
 *
 * ```typescript
 * import { noise } from '@chainsafe/libp2p-noise'
 * import { yamux } from '@chainsafe/libp2p-yamux'
 * import { mplex } from '@libp2p/mplex'
 * import { tcp } from '@libp2p/tcp'
 * import { createLibp2p, type Libp2p } from 'libp2p'
 * import { plaintext } from 'libp2p/insecure'
 * import { perfService, type PerfService } from '@libp2p/perf'
 *
 * const ONE_MEG = 1024 * 1024
 * const UPLOAD_BYTES = ONE_MEG * 1024
 * const DOWNLOAD_BYTES = ONE_MEG * 1024
 *
 * async function createNode (): Promise<Libp2p<{ perf: PerfService }>> {
 *   return createLibp2p({
 *     addresses: {
 *       listen: [
 *         '/ip4/0.0.0.0/tcp/0'
 *       ]
 *     },
 *     transports: [
 *       tcp()
 *     ],
 *     connectionEncryption: [
 *       noise(), plaintext()
 *     ],
 *     streamMuxers: [
 *       yamux(), mplex()
 *     ],
 *     services: {
 *       perf: perfService()
 *     }
 *   })
 * }
 *
 * const libp2p1 = await createNode()
 * const libp2p2 = await createNode()
 *
 * for await (const output of libp2p1.services.perf.measurePerformance(libp2p2.getMultiaddrs()[0], UPLOAD_BYTES, DOWNLOAD_BYTES)) {
 *   console.info(output)
 * }
 *
 * await libp2p1.stop()
 * await libp2p2.stop()
 * ```
 */

import { PerfService as PerfServiceClass } from './perf-service.js'
import type { AbortOptions } from '@libp2p/interface'
import type { ConnectionManager } from '@libp2p/interface-internal/connection-manager'
import type { Registrar } from '@libp2p/interface-internal/registrar'
import type { Multiaddr } from '@multiformats/multiaddr'

export interface PerfOptions extends AbortOptions {
  /**
   * By default measuring perf should include the time it takes to establish a
   * connection, so a new connection will be opened for every performance run.
   *
   * To override this and re-use an existing connection if one is present, pass
   * `true` here. (default: false)
   */
  reuseExistingConnection?: boolean
}

export interface PerfService {
  measurePerformance(multiaddr: Multiaddr, sendBytes: number, recvBytes: number, options?: PerfOptions): AsyncGenerator<PerfOutput>
}

export interface PerfOutput {
  type: 'intermediary' | 'final'
  timeSeconds: number
  uploadBytes: number
  downloadBytes: number
}

export interface PerfServiceInit {
  protocolName?: string
  maxInboundStreams?: number
  maxOutboundStreams?: number
  runOnTransientConnection?: boolean

  /**
   * Data sent/received will be sent in chunks of this size (default: 64KiB)
   */
  writeBlockSize?: number
}

export interface PerfServiceComponents {
  registrar: Registrar
  connectionManager: ConnectionManager
}

export function perfService (init: PerfServiceInit = {}): (components: PerfServiceComponents) => PerfService {
  return (components) => new PerfServiceClass(components, init)
}
