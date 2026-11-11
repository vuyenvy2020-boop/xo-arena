import { io } from "socket.io-client";

// Khi deploy: dùng địa chỉ server trong biến VITE_SERVER_URL.
// Khi chạy trên máy/Wi-Fi: tự nối vào máy đang chạy server ở cổng 3001.
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`;

export const socket = io(SERVER_URL);