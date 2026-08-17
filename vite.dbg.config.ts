import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  plugins: [{
    name: "dbg",
    enforce: "post",
    generateBundle(this: any) {
      console.log("[dbg] generateBundle env=", this.environment?.name, "cmd=", this.environment?.config?.command);
    },
  } as any],
});
