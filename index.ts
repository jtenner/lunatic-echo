/// <reference path="node_modules/as-lunatic/assembly/index.d.ts" />
import { Process } from "thread";
import { TCPServer, TCPSocket } from "net";
import { socketAccept, SocketAcceptContext } from "./socket-accept";

export function _start(): void {
  let server = TCPServer.bind([127, 0, 0, 1], 10000)!;
  let ctx = new SocketAcceptContext(server);
  let p = Process.spawn(ctx, socketAccept);

  // server is shutting down
  p.join();
}
