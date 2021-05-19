import { Channel } from "channel";
import { TelnetInstanceEvent, TelnetInstanceEventType } from "./telnet-instance";




export const enum SessionRequestType {
  Create,
  SendMessage,
  ForceClose
}

export class SessionRequest {
  constructor(
    public requestType: SessionRequestType,
    public telnetChannel: Channel<TelnetInstanceEvent>,
    public sessionId: u64 = 0,
    public message: string | null = null,
  ) {}
}

export class SessionManagerContext {
  constructor(
    public channel: Channel<SessionRequest>,
  ) {}
}

export class Session {
  constructor(
    public id: u64,
    public channels: Channel<TelnetInstanceEvent>[],
  ) {}
}
let sessionId: u64 = 0;
let sessionMap = new Map<u64, Session>();

function getNewSessionID(): u64 {
  let newId = sessionId++;
  while (!sessionMap.has(newId)) {
    newId = sessionId++;
  }
  return newId;
}

export function sessionManagerInstance(ctx: SessionManagerContext) {
  let channel = ctx.channel;
  while (channel.receive()) {
    let msg = channel.value;

    switch (msg.requestType) {
      case SessionRequestType.Create: {
        // create a session id
        let val = load<u64>(changetype<usize>(sessionId));
        let session = new Session(val, [msg.telnetChannel]);

        sessionMap.set(val, session);
        let ev = new TelnetInstanceEvent(
          TelnetInstanceEventType.AssociateSession,
          null,
          sessionId,
        );
        msg.telnetChannel.send(ev);
        break;
      }
      case SessionRequestType.SendMessage: {
        let id = msg.sessionId;
        let message = msg.message!;
        if (sessionMap.has(id)) {
          let session = sessionMap.get(id);
          let channels = session.channels;
          let channelLength = channels.length;
          for (let i = 0; i < channelLength; i++) {
            let channel = unchecked(channels[i]);
            let length = String.UTF8.byteLength(message);
            let buffer = new StaticArray<u8>(length);
            String.UTF8.encodeUnsafe(
              changetype<usize>(message),
              message.length,
              changetype<usize>(buffer),
              false,
            );

            let telnetEv = new TelnetInstanceEvent(
              TelnetInstanceEventType.OutboundMessage,
              buffer,
              id,
            );
            channel.send(telnetEv);
          }
        } else {
          trace("Cannot send message to session " + id.toString());
        }
      }
      case SessionRequestType.ForceClose: {
        let sessionId = msg.sessionId;
        let ev = new TelnetInstanceEvent(
          TelnetInstanceEventType.ForceClose,
          null,
          sessionId,
        );
        break;
      }
      default: {
        trace("something is wrong.");
      }
    }
  }
}