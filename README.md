# Memory Chess

Cờ vua rèn luyện trí nhớ, multiplayer thời gian thực. Một frontend **Expo / React Native** chạy trên Web, iOS và Android; backend **Express / Socket.IO / MongoDB / Stockfish**.

Chỉ có **Hardcore Memory** và **Strategic Peeks**. Quân hiện lúc khai cuộc, ẩn sau animation của nước đầu tiên. Mỗi nước có 60 giây, Peek có 10 lượt, trận người với người tính Elo; bot dùng để luyện tập.

## Cấu trúc

```text
app_chess/
├── apps/
│   ├── client/                  # Expo: Web / iOS / Android
│   │   ├── App.js
│   │   ├── src/
│   │   │   ├── animation/       # Hàng đợi chuyển động quân cờ
│   │   │   ├── components/      # Bàn gỗ, quân SVG, Peek, animation menu
│   │   │   ├── hooks/
│   │   │   ├── screens/         # MainMenuScreen, ChessBoardScreen
│   │   │   ├── session.js       # API, Socket.IO, phiên đăng nhập
│   │   │   └── memoryVisibility.js
│   │   └── test/                # Visibility và playback
│   └── server/
│       ├── src/
│       │   ├── server.js        # HTTP, socket, matchmaking, phòng, đồng hồ
│       │   ├── web.js           # Phục vụ bản Expo Web cùng origin
│       │   ├── lib/             # Luật, Elo transaction, Stockfish UCI
│       │   └── models/          # User và Match
│       ├── scripts/             # Database demo tạm thời
│       └── test/                # Unit, integration, engine và web hosting
├── docs/                       # API, gameplay, hướng dẫn deploy
├── infra/docker-compose.yml    # MongoDB replica set local
├── .github/workflows/ci.yml     # Kiểm thử và build trước khi deploy
├── Dockerfile                  # Build Web và chạy Node server
├── render.yaml                 # Blueprint cho Render
├── package.json                # Lệnh chung của workspace
└── pnpm-lock.yaml              # Dependency lockfile dùng chung
```

`node_modules`, `.env`, cache, bản build, thư mục native sinh tự động và `artifacts/` được Git bỏ qua. ZIP cũ được giữ trong `artifacts/` để đối chiếu.

## Chạy local

Cần **Node.js 24** và **pnpm 11.25.0**:

```bash
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
```

Mở hai terminal tại thư mục gốc:

```bash
# Terminal 1: backend + MongoDB demo tạm thời
pnpm dev:demo
```

```bash
# Terminal 2: Expo Web
pnpm dev:web
```

Mở địa chỉ Expo in ra (thường `http://localhost:8081`); API ở `http://localhost:3001`. Không cần file `.env` cho demo. Database demo mất dữ liệu khi dừng tiến trình. Lần đầu cần mạng để tải binary MongoDB.

Để lưu tài khoản lâu dài:

```bash
pnpm db:up
cp apps/server/.env.example apps/server/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
# Đặt kết quả lệnh trên vào JWT_SECRET trong apps/server/.env
pnpm dev
```

`pnpm db:up` cần Docker Desktop. Không đặt secret thật trong file `.env.example`.

## Mobile

```bash
cp apps/client/.env.example apps/client/.env
# Đổi EXPO_PUBLIC_API_URL thành IP LAN hoặc HTTPS backend
pnpm mobile:ios
# Hoặc:
pnpm mobile:android
```

iOS cần macOS/Xcode; Android cần Android Studio/JDK/SDK. Simulator iOS có thể dùng localhost, emulator Android dùng `http://10.0.2.2:3001`; máy thật dùng IP LAN của máy chạy backend. Sau lần native build đầu tiên, dùng `pnpm --filter @memory-chess/client start` để chạy Metro.

## Build và kiểm tra

```bash
pnpm check
pnpm test
pnpm build:web
pnpm build:all
```

- `build:web`: xuất Web vào `apps/client/dist`.
- `build:all`: xuất bundle Web/iOS/Android vào `apps/client/dist-all`; không tạo APK/IPA.
- `pnpm test`: chạy cả test server và client, gồm MongoDB replica set và Stockfish thật.

Để chạy bản Web và API chung port local, sau `pnpm build:web`:

```bash
SERVE_WEB=true PUBLIC_CLIENT_URL=http://localhost:3001 pnpm dev:demo
```

Mở `http://localhost:3001`. Đảm bảo `apps/client/.env` không có API URL cũ khi build Web; dùng `EXPO_NO_DOTENV=1 pnpm build:web` để bỏ qua file env local. Bản Web production mặc định dùng chính origin hiện tại, không kết nối tới localhost của người truy cập.

## Triển khai

Xem [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Dự án có Dockerfile và Render Blueprint để chạy **Web + API + Socket.IO cùng một service**, kết nối MongoDB Atlas. GitHub Pages chỉ phục vụ file tĩnh nên không chạy được backend của dự án này.

Chi tiết giao thức, luật và giao diện: [docs/GUIDE.md](docs/GUIDE.md).
