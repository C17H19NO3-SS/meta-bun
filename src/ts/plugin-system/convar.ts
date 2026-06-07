import type { ConVar as IConVar } from "../shared/types/bridge";

export class ConVar implements IConVar {
  private changeHooks: Array<(cvar: IConVar, oldValue: string, newValue: string) => void> = [];

  constructor(
    public readonly name: string,
    private value: string,
    public readonly description: string = "",
    private onValueChange?: (name: string, value: string) => void
  ) {}

  public GetName(): string {
    return this.name;
  }

  public GetFloat(): number {
    return parseFloat(this.value) || 0.0;
  }

  public GetInt(): number {
    return parseInt(this.value) || 0;
  }

  public GetString(): string {
    return this.value;
  }

  public SetFloat(value: number): void {
    this.SetValue(value.toString());
  }

  public SetInt(value: number): void {
    this.SetValue(value.toString());
  }

  public SetString(value: string): void {
    this.SetValue(value);
  }

  public AddChangeHook(callback: (cvar: IConVar, oldValue: string, newValue: string) => void): void {
    this.changeHooks.push(callback);
  }

  public UpdateValueFromBridge(newValue: string): void {
    const oldValue = this.value;
    if (oldValue === newValue) return;
    this.value = newValue;

    for (const hook of this.changeHooks) {
      try {
        hook(this, oldValue, newValue);
      } catch (e) {
        console.error(`[ConVar] Error in change hook for ${this.name}:`, e);
      }
    }
  }

  private SetValue(newValue: string): void {
    const oldValue = this.value;
    if (oldValue === newValue) return;
    this.value = newValue;

    if (this.onValueChange) {
      try {
        this.onValueChange(this.name, newValue);
      } catch (e) {
        console.error(`[ConVar] Error in onValueChange callback for ${this.name}:`, e);
      }
    }

    for (const hook of this.changeHooks) {
      try {
        hook(this, oldValue, newValue);
      } catch (e) {
        console.error(`[ConVar] Error in change hook for ${this.name}:`, e);
      }
    }
  }
}
