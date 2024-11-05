import { createServer, defineInstance } from "prool";
import { setupExeca } from "./execa/index.js";
import { toArgs } from "./utils/index.js";
import { execa } from "execa";

const stripAnsi = (str: string) => str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");

type CommandParameters = {
  /* command to use to launch*/
  command: string;
  readyMessage: string;
  redirectToFile?: string;
  onReadyCommands?: string[];
  onStopCommands?: string[];
  commandLog?: boolean;
  portArgumentName?: string;
};

export type Parameters = CommandParameters & { [key: string]: any };

export const instance = defineInstance((parameters: Parameters) => {
  const {
    command,
    redirectToFile,
    onReadyCommands,
    onStopCommands,
    commandLog,
    portArgumentName = "port",
    readyMessage,
    ...args
  } = parameters || { command: "echo" };

  const name = command;
  const process = setupExeca({
    name,
    redirectToFile: redirectToFile ? { file: redirectToFile } : undefined,
  });

  const portProvided = args[portArgumentName] ?? 3001;

  // This will let us identify the worker and we use the {PORT} as the identifier in the calling context
  // this can be used to use storage for specific instance
  let portAssigned = portProvided;

  return {
    _internal: {
      args,
      get process() {
        return process._internal.process;
      },
    },
    host: args.host ?? "localhost",
    name,
    port: portProvided,
    async start({ port = portProvided }, options) {
      portAssigned = port;
      const [actualCommand, ...moreArgs] = command.split(" ");
      const argsList = toArgs({ ...args, port }).map((v) =>
        v.replaceAll("{PORT}", portAssigned.toString())
      );
      const commandArgs = moreArgs.concat(argsList);

      if (commandLog) {
        console.log(`EXECUTING: ${actualCommand} ${commandArgs.join(" ")}`);
      }
      return await process.start(($) => $`${actualCommand} ${commandArgs}`, {
        ...options,
        // Resolve when the process is listening via a "Listening on" message.
        resolver({ process, reject, resolve }) {
          process.stdout.on("data", async (data: any) => {
            // console.log(`DATA ${data.toString()}`);
            const message = stripAnsi(data.toString());
            if (message.includes(readyMessage)) {
              if (commandLog) {
                console.log("Ready");
              }
              if (onReadyCommands) {
                const commands = onReadyCommands.map((v) =>
                  v.replaceAll("{PORT}", portAssigned.toString())
                );
                if (commandLog) {
                  console.log("executing onReadyCommands...");
                }
                for (const onReadyCommand of commands) {
                  const [bin, ...args] = onReadyCommand.split(" ");
                  try {
                    if (commandLog) {
                      await execa({
                        stdout: ["pipe", "inherit"],
                        stderr: ["pipe", "inherit"],
                      })`${bin} ${args}`;
                    } else {
                      await execa`${bin} ${args}`;
                    }
                  } catch (err: any) {
                    return reject(err.toString());
                  }
                }
              }
              if (commandLog) {
                console.log("Resolving...");
              }
              resolve();
            }
          });

          process.stderr.on("data", (err: any) => {
            if (commandLog) {
              console.log(`ERROR ${err.toString()}`);
            }
            reject(err);
          });
        },
      });
    },
    async stop() {
      if (commandLog) {
        console.log("Stopped");
      }
      if (onStopCommands) {
        const commands = onStopCommands.map((v) =>
          v.replaceAll("{PORT}", portAssigned.toString())
        );
        if (commandLog) {
          console.log("executing onStopCommands...");
        }
        for (const onStopCommand of commands) {
          const [bin, ...args] = onStopCommand.split(" ");
          try {
            if (commandLog) {
              await execa({
                stdout: ["pipe", "inherit"],
                stderr: ["pipe", "inherit"],
              })`${bin} ${args}`;
            } else {
              await execa`${bin} ${args}`;
            }
          } catch {}
        }
      }
      await process.stop();
    },
  };
});

export function createCommand(urlWithPoolId: string, parameters: Parameters) {
  const urlObject = new URL(urlWithPoolId);
  const portString = urlObject.port;
  const portAsNumber = parseInt(portString);
  const port = isNaN(portAsNumber) ? 80 : portAsNumber;
  const pathname = urlObject.pathname.slice(1);
  const poolId = parseInt(pathname);
  if (isNaN(poolId)) {
    throw new Error(
      `url need to end with poolId as pathname like for example so http://localhost:3001/<poolId>`
    );
  }
  return {
    async restart() {
      await fetch(`${urlWithPoolId}/restart`);
    },
    async start() {
      return await createServer({
        instance: instance(parameters),
        port,
      }).start();
    },
  } as const;
}
