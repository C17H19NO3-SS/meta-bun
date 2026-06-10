import { describe, expect, it } from "bun:test";
import { Filter } from "../../src/ts/shared/filter";

describe("Filter (Rule-Based Hook System AST) Unit Tests", () => {
  it("should correctly construct an EQ comparison node", () => {
    const node = Filter.Eq("health", 100);
    expect(node).toEqual({
      type: "EQ",
      field: "health",
      value: 100,
    });
  });

  it("should correctly construct a NEQ comparison node", () => {
    const node = Filter.Neq("team", 2);
    expect(node).toEqual({
      type: "NEQ",
      field: "team",
      value: 2,
    });
  });

  it("should correctly construct a GT comparison node", () => {
    const node = Filter.Gt("damage", 50);
    expect(node).toEqual({
      type: "GT",
      field: "damage",
      value: 50,
    });
  });

  it("should correctly construct a GTE comparison node", () => {
    const node = Filter.Gte("kills", 10);
    expect(node).toEqual({
      type: "GTE",
      field: "kills",
      value: 10,
    });
  });

  it("should correctly construct an LT comparison node", () => {
    const node = Filter.Lt("deaths", 5);
    expect(node).toEqual({
      type: "LT",
      field: "deaths",
      value: 5,
    });
  });

  it("should correctly construct an LTE comparison node", () => {
    const node = Filter.Lte("armor", 20);
    expect(node).toEqual({
      type: "LTE",
      field: "armor",
      value: 20,
    });
  });

  it("should correctly construct an IN comparison node", () => {
    const node = Filter.In("weapon", ["ak47", "m4a1"]);
    expect(node).toEqual({
      type: "IN",
      field: "weapon",
      value: ["ak47", "m4a1"],
    });
  });

  it("should correctly construct a CONTAINS comparison node", () => {
    const node = Filter.Contains("tags", "admin");
    expect(node).toEqual({
      type: "CONTAINS",
      field: "tags",
      value: "admin",
    });
  });

  it("should correctly construct an AND logical node", () => {
    const node = Filter.And(
      Filter.Eq("alive", true),
      Filter.Gt("health", 50)
    );
    expect(node).toEqual({
      type: "AND",
      children: [
        { type: "EQ", field: "alive", value: true },
        { type: "GT", field: "health", value: 50 },
      ],
    });
  });

  it("should correctly construct an OR logical node", () => {
    const node = Filter.Or(
      Filter.Eq("team", 2),
      Filter.Eq("team", 3)
    );
    expect(node).toEqual({
      type: "OR",
      children: [
        { type: "EQ", field: "team", value: 2 },
        { type: "EQ", field: "team", value: 3 },
      ],
    });
  });

  it("should correctly construct a NOT logical node", () => {
    const node = Filter.Not(Filter.Eq("is_bot", true));
    expect(node).toEqual({
      type: "NOT",
      children: [
        { type: "EQ", field: "is_bot", value: true },
      ],
    });
  });

  it("should correctly construct complex nested rules", () => {
    const node = Filter.And(
      Filter.Or(
        Filter.Eq("team", 2),
        Filter.Eq("team", 3)
      ),
      Filter.Not(Filter.Eq("is_bot", true)),
      Filter.Gt("health", 0)
    );

    expect(node).toEqual({
      type: "AND",
      children: [
        {
          type: "OR",
          children: [
            { type: "EQ", field: "team", value: 2 },
            { type: "EQ", field: "team", value: 3 },
          ],
        },
        {
          type: "NOT",
          children: [
            { type: "EQ", field: "is_bot", value: true },
          ],
        },
        { type: "GT", field: "health", value: 0 },
      ],
    });
  });
  
  it("should result in a JSON serializable tree", () => {
    const node = Filter.And(
      Filter.Eq("name", "Alice"),
      Filter.In("groups", ["admin", "vip"])
    );
    
    const json = JSON.stringify(node);
    const parsed = JSON.parse(json);
    
    expect(parsed).toEqual(node);
  });
});
