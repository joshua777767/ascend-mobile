import { defineConfig, devices } from "@playwright/test";

const NIX_LIBS = [
  "/nix/store/1nsvsrqp5zm96r9p3rrq3yhlyw8jiy91-libX11-1.8.12/lib",
  "/nix/store/4phl6z95v2i4525y0zpmi9v6ac0n4bx7-libXcomposite-0.4.6/lib",
  "/nix/store/h8143a07cf1vw41s49h0zahnq13zim94-libXdamage-1.1.6/lib",
  "/nix/store/0046rn5sgi6l38zl81bg2r02zlzxqqbc-libXext-1.3.6/lib",
  "/nix/store/94grp8dx897wmf0x3azpdbgzj3krz7v5-libXfixes-6.0.1/lib",
  "/nix/store/5fcbi2lycw2hz7rbn3nl5nrhhk2ki8dd-libXrandr-1.5.4/lib",
  "/nix/store/2y2hhlki6macaj9j1409q1j6i33l6igf-libxcb-1.17.0/lib",
  "/nix/store/v53v67k3s16wmak41qy0q54pd7dkbcvr-libXrender-0.9.12/lib",
  "/nix/store/2mi3dqfmc56502p1vdr4pgyf6jl3hw2a-glib-2.84.3/lib",
  "/nix/store/2jsrwgic869zynqljiqa4g7dqzpwm2yd-nss-3.101.2/lib",
  "/nix/store/gpb87pb8s826aggy1s3f352alp40dkj8-nspr-4.36/lib",
  "/nix/store/qrij2csr7p6jsfa40d7h4ckzqg4wd5w2-at-spi2-core-2.56.2/lib",
  "/nix/store/802n2ppbgbsk6211wjkg6dcjmifdcfr6-pango-1.56.3/lib",
  "/nix/store/prjwp9nyczsza4kga6a2bcb3qz1mvxg7-cairo-1.18.2/lib",
  "/nix/store/6x7s7vfydrik42pk4599sm1jcqxmi1qp-gtk+3-3.24.49/lib",
  "/nix/store/nm07kfl411ig0yv61rvginj665b6c0ms-fontconfig-2.16.0-lib/lib",
  "/nix/store/si92b84j9mqr3zshc8l78b7liq98sldc-cups-2.4.11/lib",
  "/nix/store/yw5xqn8lqinrifm9ij80nrmf0i6fdcbx-alsa-lib-1.2.13/lib",
  "/nix/store/l0d83xf43lsyhzqziy0am1cidhkcxs9q-expat-2.7.1/lib",
  "/nix/store/zbydgvn9gypb3vg88mzydn88ky6cibaz-dbus-1.14.10/lib",
  "/nix/store/yw429hvy80x2hg00lsfdfhkkib7gz54g-freetype-2.13.3/lib",
  "/nix/store/xpszkfp1gaf8jfmcsll93xg0pb4c0rk7-libdrm-2.4.124/lib",
  "/nix/store/sisfq9wihyqqjzmrpik9b4xksifw97ha-libxkbcommon-1.8.1/lib",
  "/nix/store/cpwib3zazj49fm0y04y53w4xkbqsgrgm-mesa-25.0.7/lib",
  "/nix/store/wilz94hzz4q3fss6qvv625zvww4a6s4s-mesa-libgbm-25.0.1/lib",
  "/nix/store/5flwv7rri80114p8vlz7l8qf8z5i557h-systemd-minimal-libs-257.6/lib",
].join(":");

process.env.LD_LIBRARY_PATH = NIX_LIBS + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : "");

export default defineConfig({
  testDir: "./e2e",
  timeout: 20_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./global-setup.ts",

  projects: [
    {
      name: "public",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:80",
      },
      testMatch: "public.spec.ts",
    },
    {
      name: "public-mobile",
      use: {
        ...devices["Pixel 5"],
        baseURL: "http://localhost:80",
      },
      testMatch: "mobile.spec.ts",
    },
    {
      name: "authed",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:80",
        storageState: "./auth-with-profile.json",
      },
      testMatch: "app.spec.ts",
    },
  ],
});
