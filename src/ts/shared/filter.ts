import type { RuleNode } from "./types/ast";

/**
 * Helper class to construct Rule-Based Hook System AST nodes.
 * This provides a fluent-like API to build complex JSON-serializable logic trees.
 */
export class Filter {
	/**
	 * Creates an "AND" logical node.
	 * @param children - The child nodes to combine with AND logic.
	 * @returns A RuleNode of type "AND".
	 */
	static And(...children: RuleNode[]): RuleNode {
		return { type: "AND", children };
	}

	/**
	 * Creates an "OR" logical node.
	 * @param children - The child nodes to combine with OR logic.
	 * @returns A RuleNode of type "OR".
	 */
	static Or(...children: RuleNode[]): RuleNode {
		return { type: "OR", children };
	}

	/**
	 * Creates a "NOT" logical node.
	 * @param child - The child node to negate.
	 * @returns A RuleNode of type "NOT".
	 */
	static Not(child: RuleNode): RuleNode {
		return { type: "NOT", children: [child] };
	}

	/**
	 * Creates an "EQ" (Equals) comparison node.
	 * @param field - The field name to compare.
	 * @param value - The value to compare against.
	 * @returns A RuleNode of type "EQ".
	 */
	static Eq(field: string, value: any): RuleNode {
		return { type: "EQ", field, value };
	}

	/**
	 * Creates a "NEQ" (Not Equals) comparison node.
	 * @param field - The field name to compare.
	 * @param value - The value to compare against.
	 * @returns A RuleNode of type "NEQ".
	 */
	static Neq(field: string, value: any): RuleNode {
		return { type: "NEQ", field, value };
	}

	/**
	 * Creates a "GT" (Greater Than) comparison node.
	 * @param field - The field name to compare.
	 * @param value - The value to compare against.
	 * @returns A RuleNode of type "GT".
	 */
	static Gt(field: string, value: any): RuleNode {
		return { type: "GT", field, value };
	}

	/**
	 * Creates a "GTE" (Greater Than or Equal) comparison node.
	 * @param field - The field name to compare.
	 * @param value - The value to compare against.
	 * @returns A RuleNode of type "GTE".
	 */
	static Gte(field: string, value: any): RuleNode {
		return { type: "GTE", field, value };
	}

	/**
	 * Creates an "LT" (Less Than) comparison node.
	 * @param field - The field name to compare.
	 * @param value - The value to compare against.
	 * @returns A RuleNode of type "LT".
	 */
	static Lt(field: string, value: any): RuleNode {
		return { type: "LT", field, value };
	}

	/**
	 * Creates an "LTE" (Less Than or Equal) comparison node.
	 * @param field - The field name to compare.
	 * @param value - The value to compare against.
	 * @returns A RuleNode of type "LTE".
	 */
	static Lte(field: string, value: any): RuleNode {
		return { type: "LTE", field, value };
	}

	/**
	 * Creates an "IN" comparison node.
	 * @param field - The field name to compare.
	 * @param values - The array of values to check against.
	 * @returns A RuleNode of type "IN".
	 */
	static In(field: string, values: any[]): RuleNode {
		return { type: "IN", field, value: values };
	}

	/**
	 * Creates a "CONTAINS" comparison node.
	 * @param field - The field name to compare.
	 * @param value - The value to check for within the field.
	 * @returns A RuleNode of type "CONTAINS".
	 */
	static Contains(field: string, value: any): RuleNode {
		return { type: "CONTAINS", field, value };
	}
}
