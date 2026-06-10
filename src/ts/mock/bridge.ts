import { decode, encode } from "@msgpack/msgpack";

/**
 * Starts a mock TCP server simulating the C++ Metamod bridge
 * for the purpose of testing schema dumping.
 */
export function startMockBridge(port = 27013) {
	return Bun.listen({
		hostname: "127.0.0.1",
		port: port,
		socket: {
			data(socket, data) {
				try {
					let buffer = Buffer.from(data);
					while (buffer.length >= 4) {
						const length = buffer.readUInt32BE(0);
						if (buffer.length >= 4 + length) {
							const payloadBuffer = buffer.subarray(4, 4 + length);
							buffer = buffer.subarray(4 + length);

							const payload = decode(payloadBuffer) as any;

							if (payload.action === "dump_schema") {
								console.log("[MockBridge] Received dump_schema request.");
								const schemaDump = JSON.stringify({
									CCSPlayerController: {
										m_iHealth: { type: "int", offset: 100 },
									},
								});

								// Send response
								const responsePayload = {
									event: "schema_dump_result",
									data: schemaDump,
								};

								const responseMsgpack = encode(responsePayload);
								const responseBuffer = Buffer.from(
									responseMsgpack.buffer,
									responseMsgpack.byteOffset,
									responseMsgpack.byteLength,
								);

								const header = Buffer.alloc(4);
								header.writeUInt32BE(responseBuffer.length, 0);

								socket.write(Buffer.concat([header, responseBuffer]));
							}
						} else {
							break;
						}
					}
				} catch (err) {
					console.error("[MockBridge] Error processing data:", err);
				}
			},
			open(socket) {
				console.log("[MockBridge] Connection opened.");
			},
			close(socket) {
				console.log("[MockBridge] Connection closed.");
			},
			error(socket, error) {
				console.error("[MockBridge] Error:", error);
			},
		},
	});
}
