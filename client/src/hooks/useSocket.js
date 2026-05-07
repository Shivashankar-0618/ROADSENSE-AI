import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

let socketInstance = null;

const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(
      import.meta.env.VITE_SOCKET_URL || window.location.origin,
      {
        autoConnect: false,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        transports: ["websocket", "polling"],
      }
    );
  }
  return socketInstance;
};

/**
 * useSocket — Connect to Socket.IO, join a region room,
 * and listen for events.
 *
 * @param {string} region - Room to join (user's region)
 * @param {object} listeners - { eventName: handler }
 */
const useSocket = (region, listeners = {}) => {
  const socket = useRef(getSocket());

  useEffect(() => {
    const s = socket.current;
    if (!s.connected) s.connect();

    if (region) s.emit("join_region", region);

    // Register event listeners
    Object.entries(listeners).forEach(([event, handler]) => {
      s.on(event, handler);
    });

    return () => {
      // Cleanup listeners on unmount
      Object.entries(listeners).forEach(([event, handler]) => {
        s.off(event, handler);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  const emit = useCallback((event, data) => {
    socket.current.emit(event, data);
  }, []);

  return { socket: socket.current, emit };
};

export { useSocket, getSocket };
export default useSocket;
