import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decode, encode } from "@msgpack/msgpack";
import { startMockBridge } from "../src/ts/mock/bridge";

async function generateSchema() {
	// Start the mock bridge for testing
	const mockServer = startMockBridge(0);
	console.log(`[CLI] Starting mock bridge on port ${mockServer.port}...`);

	try {
		console.log("[CLI] Connecting to bridge...");
		const socket = await Bun.connect({
			hostname: "127.0.0.1",
			port: mockServer.port,
			socket: {
				open(socket) {
					console.log("[CLI] Connected to bridge. Requesting schema dump...");

					const action = { action: "dump_schema" };
					const msgpackData = encode(action);
					const payload = Buffer.from(
						msgpackData.buffer,
						msgpackData.byteOffset,
						msgpackData.byteLength,
					);
					const header = Buffer.alloc(4);
					header.writeUInt32BE(payload.length, 0);
					socket.write(Buffer.concat([header, payload]));
				},
				data(socket, data) {
					try {
						let buffer = Buffer.from(data);
						while (buffer.length >= 4) {
							const length = buffer.readUInt32BE(0);
							if (buffer.length >= 4 + length) {
								const payloadBuffer = buffer.subarray(4, 4 + length);
								buffer = buffer.subarray(4 + length);

								const response = decode(payloadBuffer) as any;

								if (response.event === "schema_dump_result") {
									console.log("[CLI] Received schema dump result.");
									const schemaData = JSON.parse(response.data);
									console.log(
										"[CLI] Schema parsed. Classes:",
										Object.keys(schemaData).join(", "),
									);

									// Ensure src/ts/generated/ exists
									const generatedDir = join(
										process.cwd(),
										"src",
										"ts",
										"generated",
									);
									if (!existsSync(generatedDir)) {
										mkdirSync(generatedDir, { recursive: true });
									}

									let fileContent = `// Auto-generated schema exports
// @ts-nocheck
`;

									for (const [className, props] of Object.entries(schemaData)) {
										fileContent += `\nexport class ${className} {\n`;
										fileContent += `\tconstructor(public entityId: number) {}\n`;
										for (const [propName, propData] of Object.entries(
											props as any,
										)) {
											const type = (propData as any).type;
											let tsType = "any";
											if (type === "int" || type === "float") {
												tsType = "number";
											} else if (type === "bool" || type === "boolean") {
												tsType = "boolean";
											} else if (type === "string") {
												tsType = "string";
											}

											fileContent += `\n\tasync get_${propName}(): Promise<${tsType}> {\n`;
											fileContent += `\t\treturn await globalThis.Bridge.SendAsync({ action: "GetEntityProp", entityId: this.entityId, propName: "${propName}" });\n`;
											fileContent += `\t}\n`;

											fileContent += `\n\tset_${propName}(value: ${tsType}): void {\n`;
											fileContent += `\t\tglobalThis.Bridge.Send({ action: "SetEntityProp", entityId: this.entityId, propName: "${propName}", value });\n`;
											fileContent += `\t}\n`;
										}
										fileContent += `}\n`;
									}

									// Create src/ts/generated/index.ts file
									const indexPath = join(generatedDir, "index.ts");
									writeFileSync(indexPath, fileContent);
									console.log("[CLI] Successfully created", indexPath);

									socket.end();
									mockServer.stop();
									process.exit(0);
								}
							} else {
								break;
							}
						}
					} catch (err) {
						console.error("[CLI] Error processing response:", err);
						socket.end();
						mockServer.stop();
						process.exit(1);
					}
				},
				error(socket, error) {
					console.error("[CLI] Socket error:", error);
					socket.end();
					mockServer.stop();
					process.exit(1);
				},
				close(socket) {
					console.log("[CLI] Connection closed.");
				},
			},
		});
	} catch (err) {
		console.error("[CLI] Connection failed:", err);
		mockServer.stop();
		process.exit(1);
	}
}

generateSchema();
