import { TCPSocket } from "net";
import {
  telnet_event_data_t,
  telnet_event_sb_t,
  telnet_t,
  TELNET_TELOPT_BINARY,
  TELNET_TELOPT_NAWS,
} from "as-telnet";
import { Channel } from "channel";
import { Process } from "thread";
import { SessionRequest, SessionRequestType } from "./session-manager";

export class TelnetInstanceContext {
  constructor(
    public tcpSocket: TCPSocket,
    public sessionManager: Channel<SessionRequest>,
  ) {}
}


export const enum TelnetInstanceEventType {
  ForceClose,
  IncomingData,
  AssociateSession,
  OutboundMessage
}

export class TelnetInstanceEvent {
  constructor(
    public type: TelnetInstanceEventType,
    public data: StaticArray<u8> | null = null,
    public sessionId: u64 = 0,
  ) {}
}

export class SocketReadContext {
  constructor(
    public socket: TCPSocket,
    public channel: Channel<TelnetInstanceEvent>,
  ) {}
}

let support = new StaticArray<u8>(255);
support[TELNET_TELOPT_NAWS] = 0b11;
support[TELNET_TELOPT_BINARY] = 0b11;
let t: telnet_t<TCPSocket>;

export function telnetInstance(ctx: TelnetInstanceContext): void {
  let socket = ctx.tcpSocket;
  let message: TelnetInstanceEvent;
  let telnetEventChannel = Channel.create<TelnetInstanceEvent>();
  let hasSession = false;
  let sessionId: u64 = 0;

  let sessionCreate = new SessionRequest(
    SessionRequestType.Create,
    telnetEventChannel,
  );
  ctx.sessionManager.send(sessionCreate);

  t = new telnet_t(socket, support, 0);
  t.onData = (t: telnet_t<TCPSocket>, ev: telnet_event_data_t): void => {
    // echo server
    t.send_buffer(ev.data);
  };
  t.onSend = (t: telnet_t<TCPSocket>, buffer: StaticArray<u8>): void => {
    t.data.writeBuffer(buffer);
  };

  t.onSubnegotiate = (t: telnet_t<TCPSocket>, ev: telnet_event_sb_t): void => {
    if (ev.telopt == TELNET_TELOPT_NAWS) {
      if (ev.buffer.length == 4) {
        let cols = bswap<u16>(load<u16>(changetype<usize>(ev.buffer)));
        let rows = bswap<u16>(load<u16>(changetype<usize>(ev.buffer), sizeof<u16>()));
        trace("naws", 2, <f64>cols, <f64>rows);
      }
    }
  };

  // asynchronously read the socket data and send it via the telnet instance channel
  let socketReadContext = new SocketReadContext(socket, telnetEventChannel);
  Process.spawn(socketReadContext, (ctx) => {
    let buffer: StaticArray<u8> | null;
    while (buffer = ctx.socket.read()) {
      let ev = new TelnetInstanceEvent(TelnetInstanceEventType.IncomingData, buffer);
      ctx.channel.send(ev);
    }
  });

  while (telnetEventChannel.receive()) {
    message = telnetEventChannel.value;

    switch(message.type) {
      case TelnetInstanceEventType.ForceClose: {
        t.send_text("Socket closed.");
        socket.close();
        return;
      }
      case TelnetInstanceEventType.IncomingData: {
        t.recv(message.data!);
        break;
      }
      case TelnetInstanceEventType.AssociateSession: {
        hasSession = true;
        sessionId = message.sessionId;
        break;
      }
      default: {
        t.send_text("Socket closed. (Error)");
        socket.close();
        return;
      }
    }
  }
}
