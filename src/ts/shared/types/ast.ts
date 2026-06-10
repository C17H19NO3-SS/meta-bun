/**
 * Represents the types of operators available in a rule.
 */
export type RuleOperator =
	| "AND"
	| "OR"
	| "NOT"
	| "EQ"
	| "NEQ"
	| "GT"
	| "GTE"
	| "LT"
	| "LTE"
	| "IN"
	| "CONTAINS";

/**
 * Represents a node in the rule-based hook system's Abstract Syntax Tree (AST).
 * These nodes can be combined to form complex logic for synchronous hooks.
 */
export interface RuleNode {
	/**
	 * The type of operator for this node.
	 */
	type: RuleOperator;

	/**
	 * The field name to compare.
	 * Required for comparison operators (EQ, NEQ, GT, GTE, LT, LTE, IN, CONTAINS).
	 */
	field?: string;

	/**
	 * The value to compare against.
	 * Required for comparison operators.
	 */
	value?: any;

	/**
	 * Child nodes.
	 * Used for logical operators (AND, OR, NOT).
	 */
	children?: RuleNode[];
}
