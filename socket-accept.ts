import { TCPServer, TCPSocket } from "net";
import { Process } from "thread";
import { TelnetInstanceContext, telnetInstance } from "./telnet-instance";

export class SocketAcceptContext {
  public constructor(
    public tcpServer: TCPServer,
  ) {}
}

export function socketAccept(ctx: SocketAcceptContext): void {
  let tcpServer = ctx.tcpServer;
  let socket: TCPSocket | null;
  while (socket = tcpServer.accept()) {
    let telnetCtx = new TelnetInstanceContext(socket!);
    Process.spawn<TelnetInstanceContext>(telnetCtx, telnetInstance);
  }
}