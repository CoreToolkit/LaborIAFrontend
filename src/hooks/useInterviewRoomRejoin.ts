import React from "react";
import { readPersistedRejoinState } from "@/utils/interviewRoom";

type JoinRoomOverrideOptions = {
  roomIdOverride?: string;
  displayNameOverride?: string;
  allowRejoinDuringInProgress?: boolean;
};

type UseInterviewRoomRejoinArgs = {
  displayName: string;
  roomId: string;
  roleId: string;
  isJoined: boolean;
  isConnecting: boolean;
  routerIsReady: boolean;
  setDisplayName: React.Dispatch<React.SetStateAction<string>>;
  setRoomId: React.Dispatch<React.SetStateAction<string>>;
  joinRoom: (options?: JoinRoomOverrideOptions) => Promise<void>;
  autoRejoinAttemptedRef: React.MutableRefObject<boolean>;
};

export function useInterviewRoomRejoin({
  displayName,
  roomId,
  roleId,
  isJoined,
  isConnecting,
  routerIsReady,
  setDisplayName,
  setRoomId,
  joinRoom,
  autoRejoinAttemptedRef,
}: UseInterviewRoomRejoinArgs) {
  React.useEffect(() => {
    const persisted = readPersistedRejoinState();
    if (!persisted) {
      return;
    }

    if (!displayName.trim()) {
      setDisplayName(persisted.displayName);
    }

    if (!roomId.trim()) {
      setRoomId(persisted.roomId);
    }
  }, [displayName, roomId, setDisplayName, setRoomId]);

  React.useEffect(() => {
    if (!routerIsReady || isJoined || isConnecting || autoRejoinAttemptedRef.current) {
      return;
    }

    const persisted = readPersistedRejoinState();
    if (!persisted) {
      return;
    }

    if (persisted.roleId && roleId && persisted.roleId !== roleId) {
      return;
    }

    if (!displayName.trim() || !roomId.trim()) {
      return;
    }

    autoRejoinAttemptedRef.current = true;
    void joinRoom({
      roomIdOverride: persisted.roomId,
      displayNameOverride: persisted.displayName,
      allowRejoinDuringInProgress: true,
    });
  }, [
    autoRejoinAttemptedRef,
    displayName,
    isConnecting,
    isJoined,
    joinRoom,
    roleId,
    roomId,
    routerIsReady,
  ]);
}
