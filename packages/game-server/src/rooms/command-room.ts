import { Room } from "colyseus";

import { OnJoinCommand } from "./OnJoinCommand";
import { BoardgameRoomState } from "./schema/MyRoomState";
import { Dispatcher } from "../command";

class CommandRoom extends Room<BoardgameRoomState> {
  dispatcher = new Dispatcher(this);

  onCreate() {
    this.setState(new BoardgameRoomState());
  }

  onJoin(client, options) {
    this.dispatcher.dispatch(new OnJoinCommand(), {
        sessionId: client.sessionId
    });
  }

  onDispose() {
    this.dispatcher.stop();
  }
}
