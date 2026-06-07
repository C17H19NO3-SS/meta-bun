import { encode } from "@msgpack/msgpack";
import type {
	BridgeProtocol,
	BunSocket,
	GameAction,
} from "../shared/types/bridge";

/**
 * Handles lower-level socket transmission and protocol encoding for communicating
 * with the C++ Metamod bridge.
 */
export class Bridge {
	private socket: BunSocket | null = null;
	private protocol: BridgeProtocol = "ndjson";

	/**
	 * Binds the active TCP socket communication stream.
	 *
	 * @param socket The active Bun socket or null.
	 */
	public SetSocket(socket: BunSocket | null): void {
		this.socket = socket;
	}

	/**
	 * Set the communication framing and encoding protocol.
	 *
	 * @param protocol The selected bridge protocol.
	 */
	public SetProtocol(protocol: BridgeProtocol): void {
		this.protocol = protocol;
	}

	/**
	 * Sends a structured GameAction payload to the C++ Metamod bridge using
	 * the active protocol framing.
	 *
	 * @param action The GameAction payload to transmit.
	 */
	public Send(action: GameAction): void {
		if (!this.socket) {
			console.warn("[Bridge] Cannot send, socket not connected.");
			return;
		}

		try {
			if (this.protocol === "ndjson") {
				this.socket.write(`${JSON.stringify(action)}\n`);
			} else if (this.protocol === "length_prefixed_json") {
				const payload = Buffer.from(JSON.stringify(action));
				const header = Buffer.alloc(4);
				header.writeUInt32BE(payload.length, 0);
				this.socket.write(Buffer.concat([header, payload]));
			} else if (this.protocol === "length_prefixed_msgpack") {
				const msgpackData = encode(action);
				const payload = Buffer.from(
					msgpackData.buffer,
					msgpackData.byteOffset,
					msgpackData.byteLength,
				);
				const header = Buffer.alloc(4);
				header.writeUInt32BE(payload.length, 0);
				this.socket.write(Buffer.concat([header, payload]));
			}
		} catch (err) {
			console.error("[Bridge] Send serialization error:", err);
		}
	}
}
