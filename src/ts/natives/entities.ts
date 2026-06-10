import { GetContext } from "../shared/context-store";

/**
 * Creates a new entity on the server by its classname.
 *
 * @param classname The classname of the entity (e.g., "prop_dynamic", "info_target").
 */
export function CreateEntity(classname: string): void {
	GetContext().CreateEntity(classname);
}

/**
 * Sets a property (key-value) on an entity.
 *
 * @param entity The entity index.
 * @param prop The property name (e.g., "m_iHealth", "targetname").
 * @param value The value to set.
 */
export function SetEntityProp(
	entity: number,
	prop: string,
	value: string | number,
): void {
	GetContext().SetEntityProp(entity, prop, value);
}
