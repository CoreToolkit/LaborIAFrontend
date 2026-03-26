import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";
import { Server as IOServer, Socket } from "socket.io";

interface JoinRoomPayload {
  roomId: string;
  displayName: string;
}

interface SessionDescriptionPayload {
  target: string;
  sdp: RTCSessionDescriptionInit;
}

interface IceCandidatePayload {
  target: string;
  candidate: RTCIceCandidateInit;
}

interface RoomPeer {
  socketId: string;
  displayName: string;
}

interface ServerToClientEvents {
  "room-users": (payload: { selfId: string; users: RoomPeer[] }) => void;
  "peer-joined": (payload: RoomPeer) => void;
  "peer-left": (payload: { socketId: string }) => void;
  offer: (payload: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  answer: (payload: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  "ice-candidate": (payload: { from: string; candidate: RTCIceCandidateInit }) => void;
  error: (payload: { message: string }) => void;
}

interface ClientToServerEvents {
  "join-room": (payload: JoinRoomPayload) => void;
  "leave-room": () => void;
  offer: (payload: SessionDescriptionPayload) => void;
  answer: (payload: SessionDescriptionPayload) => void;
  "ice-candidate": (payload: IceCandidatePayload) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  roomId?: string;
  displayName?: string;
}

type AppIOServer = IOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface SocketServer extends HTTPServer {
  io?: AppIOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

interface ParticipantInfo {
  socketId: string;
  roomId: string;
  displayName: string;
}

const participants = new Map<string, ParticipantInfo>();

const normalizeRoomId = (value: string): string => value.trim().slice(0, 64);
const normalizeDisplayName = (value: string): string => value.trim().slice(0, 48);

const leaveCurrentRoom = (socket: AppSocket): void => {
  const participant = participants.get(socket.id);
  if (!participant) {
    return;
  }

  participants.delete(socket.id);
  socket.leave(participant.roomId);
  socket.to(participant.roomId).emit("peer-left", { socketId: socket.id });
};

const relayToPeer = <T extends { target: string }>(
  io: AppIOServer,
  socket: AppSocket,
  payload: T,
  event: "offer" | "answer" | "ice-candidate",
  outbound: Omit<T, "target"> & { from: string }
): void => {
  const sender = participants.get(socket.id);
  const targetPeer = participants.get(payload.target);

  if (!sender || !targetPeer || sender.roomId !== targetPeer.roomId) {
    socket.emit("error", { message: "No se pudo enrutar el evento de senalizacion." });
    return;
  }

  io.to(payload.target).emit(event, outbound as never);
};

const onConnection = (io: AppIOServer, socket: AppSocket): void => {
  socket.on("join-room", ({ roomId, displayName }) => {
    const safeRoomId = normalizeRoomId(roomId);
    const safeDisplayName = normalizeDisplayName(displayName) || `Usuario-${socket.id.slice(0, 5)}`;

    if (!safeRoomId) {
      socket.emit("error", { message: "El room ID es obligatorio." });
      return;
    }

    leaveCurrentRoom(socket);

    socket.data.roomId = safeRoomId;
    socket.data.displayName = safeDisplayName;

    socket.join(safeRoomId);

    participants.set(socket.id, {
      socketId: socket.id,
      roomId: safeRoomId,
      displayName: safeDisplayName,
    });

    const usersInRoom: RoomPeer[] = [...participants.values()]
      .filter((peer) => peer.roomId === safeRoomId && peer.socketId !== socket.id)
      .map((peer) => ({ socketId: peer.socketId, displayName: peer.displayName }));

    socket.emit("room-users", {
      selfId: socket.id,
      users: usersInRoom,
    });

    socket.to(safeRoomId).emit("peer-joined", {
      socketId: socket.id,
      displayName: safeDisplayName,
    });
  });

  socket.on("offer", (payload) => {
    relayToPeer(io, socket, payload, "offer", {
      from: socket.id,
      sdp: payload.sdp,
    });
  });

  socket.on("answer", (payload) => {
    relayToPeer(io, socket, payload, "answer", {
      from: socket.id,
      sdp: payload.sdp,
    });
  });

  socket.on("ice-candidate", (payload) => {
    relayToPeer(io, socket, payload, "ice-candidate", {
      from: socket.id,
      candidate: payload.candidate,
    });
  });

  socket.on("leave-room", () => {
    leaveCurrentRoom(socket);
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(_: NextApiRequest, res: NextApiResponseWithSocket): void {
  if (res.socket.server.io) {
    res.status(200).end();
    return;
  }

  const io = new IOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(res.socket.server, {
    path: "/api/socketio",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    onConnection(io, socket);
  });

  res.socket.server.io = io;
  res.status(200).end();
}
