// Auto-generated schema exports
// @ts-nocheck

export class CCSPlayerController {
	constructor(public entityId: number) {}

	async get_m_iHealth(): Promise<number> {
		return await globalThis.Bridge.SendAsync({
			action: "GetEntityProp",
			entityId: this.entityId,
			propName: "m_iHealth",
		});
	}

	set_m_iHealth(value: number): void {
		globalThis.Bridge.Send({
			action: "SetEntityProp",
			entityId: this.entityId,
			propName: "m_iHealth",
			value,
		});
	}
}
