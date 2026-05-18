let socketServerRef: any = null;

export function setSocketServer(io: any) {
  socketServerRef = io;
}

export function getSocketStatus() {
  if (!socketServerRef) {
    return {
      status: "not_configured",
      connectedClients: 0,
      rooms: 0,
    };
  }

  const sockets = socketServerRef.sockets?.sockets;
  const adapterRooms = socketServerRef.sockets?.adapter?.rooms;

  return {
    status: "ok",
    connectedClients: sockets?.size ?? 0,
    rooms: adapterRooms?.size ?? 0,
  };
}