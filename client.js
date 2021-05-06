const net = require("net");
let socket = net.connect(10000, "127.0.0.1");

socket.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
socket.on("connect", () => {
  console.log("Connected.\r\n")
  socket.write("Hello world!\r\n");
});

socket.pipe(process.stdout);

process.stdin.pipe(socket);
