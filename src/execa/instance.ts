import type { EventEmitter } from "eventemitter3";

type EventTypes = {
  exit: [code: number | null, signal: NodeJS.Signals | null];
  listening: [];
  message: [message: string];
  stderr: [message: string];
  stdout: [message: string];
};

export type InstanceStartOptions_internal = {
  emitter: EventEmitter<EventTypes>;
  status: Instance["status"];
};

export type Instance<
  _internal extends object | undefined = object | undefined,
> = Pick<
  EventEmitter<EventTypes>,
  | "addListener"
  | "off"
  | "on"
  | "once"
  | "removeAllListeners"
  | "removeListener"
> & {
  _internal: _internal;
  /**
   * Creates an instance.
   */
  create(
    parameters?: { port?: number | undefined } | undefined
  ): Omit<Instance<_internal>, "create">;
  /**
   * Host the instance is running on.
   */
  host: string;
  /**
   * Name of the instance.
   *
   * @example "anvil"
   */
  name: string;
  /**
   * Port the instance is running on.
   */
  port: number;
  /**
   * Set of messages emitted from the `"message"` event stored in-memory,
   * with length {@link InstanceOptions`messageBuffer`}.
   * Useful for debugging.
   *
   * @example ["Listening on http://127.0.0.1", "Started successfully."]
   */
  messages: { clear(): void; get(): string[] };
  /**
   * Retarts the instance.
   */
  restart(): Promise<void>;
  /**
   * Status of the instance.
   *
   * @default "idle"
   */
  status:
    | "idle"
    | "restarting"
    | "stopped"
    | "starting"
    | "started"
    | "stopping";
  /**
   * Starts the instance.
   *
   * @returns A function to stop the instance.
   */
  start(): Promise<() => void>;
  /**
   * Stops the instance.
   */
  stop(): Promise<void>;
};
