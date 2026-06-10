import { BasePlugin, Command, ReplyToCommand, players } from "meta-bun/core";

export default class TestCommandsPlugin extends BasePlugin {
    public override name = "Test Commands";
    public override version = "1.0.0";
    public override author = "MetaBun Team";

    @Command("sm_test_public", null, "Standard public test command")
    public OnTestPublic(client: number, args: string[]): void {
        ReplyToCommand(client, `[Test] Public command called with ${args.length} args.`);
    }

    @Command("sm_test_silent", { silent: true }, "Silent test command")
    public OnTestSilent(client: number, args: string[]): void {
        ReplyToCommand(client, `[Test] Silent command called with ${args.length} args.`);
    }

    @Command("sm_test_target", null, "Targeting test command")
    public OnTestTarget(client: number, args: string[]): void {
        if (args.length === 0) {
            ReplyToCommand(client, "[Test] Usage: sm_test_target <pattern>");
            return;
        }

        const pattern = args[0]!;
        const targets = players.FindTargets(pattern, client);

        if (targets.length === 0) {
            ReplyToCommand(client, `[Test] No targets found for pattern: ${pattern}`);
            return;
        }

        const names = targets.map(p => p.name).join(", ");
        ReplyToCommand(client, `[Test] Found ${targets.length} targets: ${names}`);
    }
}
