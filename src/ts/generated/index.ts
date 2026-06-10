// Auto-generated schema exports
// @ts-nocheck

export class CCSPlayerController {
	constructor(public entityId: number) {}

	get m_iHealth(): number {
		return globalThis.Bridge.Send({
			action: "GetEntityProp",
			entityId: this.entityId,
			propName: "m_iHealth",
		});
	}

	set m_iHealth(value: number) {
		globalThis.Bridge.Send({
			action: "SetEntityProp",
			entityId: this.entityId,
			propName: "m_iHealth",
			value,
		});
	}
}
