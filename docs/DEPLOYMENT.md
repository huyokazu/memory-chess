# Đưa Memory Chess lên GitHub và deploy

## Kiến trúc deploy

Một Node service phục vụ Expo Web, HTTP API và Socket.IO trên cùng HTTPS origin. Stockfish chạy trong process con của server. MongoDB Atlas lưu tài khoản, lịch sử và Elo; cần replica set để transaction Elo hoạt động.

Cấu hình hiện tại chạy **một instance**, vì trạng thái phòng và đồng hồ nằm trong RAM. Không bật autoscaling nhiều instance. Restart/deploy sẽ kết thúc các ván đang chạy; tài khoản và kết quả đã ghi vẫn được giữ trong MongoDB.

## GitHub

Đăng nhập GitHub CLI trên máy của bạn:

```bash
gh auth login --hostname github.com --git-protocol https --web
```

Lần đầu tạo repository riêng tư từ thư mục gốc (đổi OWNER thành tài khoản của bạn):

```bash
git init -b main
git add .
git commit -m "Prepare Memory Chess monorepo for deployment"
gh repo create OWNER/memory-chess --private --source=. --remote=origin --push
```

Nếu repository đã tồn tại, kiểm tra remote và lịch sử trước khi thêm origin/push; không force push. `.gitignore` loại secret và file sinh tự động. Chỉ dùng `--public` nếu muốn công khai mã nguồn.

## Render + MongoDB Atlas

1. Đăng nhập Atlas, chọn cluster và database `memory_chess`. Tạo database user dành riêng cho app với quyền đọc/ghi database này. Connection string có dạng `mongodb+srv://.../memory_chess?...`.
2. Đăng nhập Render, chọn **New → Blueprint** và repository GitHub. File `render.yaml` có sẵn cấu hình Docker, `/health`, secret JWT tự sinh và kiểm tra CI trước auto-deploy.
3. Nhập `MONGODB_URI` trực tiếp trong biểu mẫu environment của Render. Không đưa vào GitHub/chat. Atlas cần cho phép các outbound IP của Render service trong Network Access; dùng danh sách IP Render cung cấp.
4. Blueprint dùng `plan: free`; kiểm tra plan trước khi xác nhận tạo service. Free có thể ngủ khi không hoạt động và khởi động lại chậm. Với trận thời gian thực cần độ ổn định, chọn gói luôn chạy sau khi đã thống nhất chi phí.
5. Render cung cấp `RENDER_EXTERNAL_URL`; server tự thêm origin này vào allowlist và dùng nó cho link mời. Không cần hard-code URL vào frontend Web.
6. Nếu dùng custom domain hoặc provider khác, đặt `PUBLIC_CLIENT_URL=https://ten-mien-cua-ban` và `CLIENT_ORIGINS` thành các origin bổ sung, phân cách bằng dấu phẩy.

Render không provision MongoDB qua Blueprint này. Chỉ deploy hoàn tất khi service kết nối được MongoDB và `/health` trả HTTP 200.

### Environment của server

| Biến | Cách đặt |
| --- | --- |
| `MONGODB_URI` | Secret connection string của replica set / Atlas |
| `JWT_SECRET` | Secret ngẫu nhiên tối thiểu 32 ký tự; Blueprint tự sinh |
| `NODE_ENV` | `production` |
| `PORT` | Provider đặt hoặc `10000` trong Docker |
| `SERVE_WEB` | `true` |
| `WEB_DIST` | Docker đã đặt `/app/public` |
| `TRUST_PROXY_HOPS` | `1` trên Render; điều chỉnh đúng số reverse proxy nếu dùng nơi khác |
| `MAX_BOT_GAMES` | `1` trong Blueprint để giới hạn tài nguyên ban đầu |
| `PUBLIC_CLIENT_URL` | Không bắt buộc trên Render; đặt khi dùng custom domain |
| `CLIENT_ORIGINS` | Origin frontend bổ sung nếu có |

Không đặt `EXPO_PUBLIC_API_URL=http://localhost:3001` trong build Web production. Native cần build riêng với `EXPO_PUBLIC_API_URL` là HTTPS URL thật.

## Docker trên hosting khác

Tại gốc dự án:

```bash
docker build -t memory-chess .
# File apps/server/.env chứa các giá trị production của bạn.
docker run --rm --env-file apps/server/.env -e NODE_ENV=production -e SERVE_WEB=true -e PORT=10000 -p 10000:10000 memory-chess
```

Đặt HTTPS reverse proxy phía trước container, giữ kết nối WebSocket upgrade và cấu hình `PUBLIC_CLIENT_URL` đúng domain. Dữ liệu phải lưu trong MongoDB bên ngoài container.

## Kiểm tra sau deploy

- Truy cập `/health`: HTTP 200, `ok: true`.
- Trang chính tải được JavaScript/SVG và không gọi API localhost.
- Tạo hai tài khoản thử; tạo/join phòng bằng mã, thực hiện nước đầu, Peek, đầu hàng và kiểm tra Elo.
- Chơi một ván bot, xác nhận Stockfish trả lời.
- Reload/reconnect vào ván đang chạy; đồng hồ không reset.

CI chạy test và export cả ba nền tảng; chưa thay thế kiểm tra thiết bị mobile thật hoặc smoke test của URL production.

Nguồn: [Render WebSockets](https://render.com/docs/websocket), [Render Blueprint](https://render.com/docs/blueprint-spec), [Render Free](https://render.com/docs/free), [MongoDB Atlas](https://www.mongodb.com/docs/atlas/).
