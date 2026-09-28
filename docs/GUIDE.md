# API, luật chơi và giao diện

Hướng dẫn cài đặt nằm ở [README](../README.md); triển khai ở [DEPLOYMENT](DEPLOYMENT.md). Các file backend nằm trong `apps/server/src`, frontend trong `apps/client/src`.

### Xác thực và HTTP API

Username được chuyển về chữ thường, dài 3–24 ký tự, chỉ gồm `a-z`, `0-9`, `_`. Mật khẩu có ít nhất 8 ký tự và tối đa 72 byte; băm bằng bcrypt. Elo ban đầu là 1200 và không nhận từ client.

| Endpoint | Request / quyền |
| --- | --- |
| `POST /api/auth/register` | `{ "username": "alice", "password": "your-password" }` |
| `POST /api/auth/login` | Cùng payload; trả `{ token, user }` |
| `GET /api/me` | Header `Authorization: Bearer <token>` |
| `GET /api/leaderboard` | Có JWT, top 30 |
| `GET /api/matches` | Có JWT, 20 ván gần nhất của chính người chơi |

JWT có thời hạn 7 ngày. Trên native, token lưu bằng `expo-secure-store`; trên Web, lưu ở localStorage. Server kiểm tra danh tính ở handshake, không tin userId, Elo, màu quân, kết quả hoặc thời gian do client gửi lên.

### Socket.IO API

Kết nối bằng `io(API_URL, { auth: { token } })`. Mọi lệnh dùng acknowledgement:

```js
socket.timeout(15000).emit('game:move', {
  roomId,
  from: 'e2',
  to: 'e4',
}, (timeoutError, response) => {
  if (timeoutError) console.error('Server chưa phản hồi');
  else if (!response.ok) console.error(response.error.message);
  else console.log('Nước đi đã được chấp nhận');
});
```

| Client → server | Payload |
| --- | --- |
| `match:find` | `{ mode: "hardcore" hoặc "peeks" }` |
| `match:cancel` | `{}` |
| `party:create` | `{ mode }` |
| `party:join` | `{ code: "123456" }` — chuỗi đúng 6 số |
| `room:leave` | `{ roomId }` — chỉ phòng chờ hoặc trận đã lưu kết quả |
| `bot:start` | `{ mode, elo: 800 hoặc 1200 hoặc 1600 }` |
| `game:move` | `{ roomId, from, to, promotion?: "q" / "r" / "b" / "n" }` |
| `game:peek` | `{ roomId }` |
| `game:resign` | `{ roomId }` |
| `game:sync` | `{ roomId }` |

| Server → client | Ý nghĩa |
| --- | --- |
| `profile` | Hồ sơ và Elo mới |
| `queue:state` | Trạng thái chờ ghép trận |
| `game:state` | Snapshot riêng cho từng người: FEN, màu, lượt, Peek, visibility, deadline, kết quả |
| `game:clock` | `{ roomId, turn, deadline, serverNow, remainingMs }`, mỗi 250 ms |
| `game:over` | Snapshot kết thúc, kèm thay đổi Elo sau khi lưu |
| `room:closed` / `room:failed` | Phòng hết hạn, đóng hoặc tạo trận thất bại |
| `session:replaced` | Có phiên đăng nhập mới của cùng tài khoản |

`game:state.visible` chỉ áp dụng cho người nhận; frontend tính lại visibility từ `ply`, chế độ và Peek để không ẩn nhầm bàn cờ ban đầu; Peek của đối thủ không làm lộ bàn cờ của bạn. Nước vừa đi được thông báo bằng tọa độ (`e7 → e5`) để người chơi có thể ghi nhớ nước của đối thủ. Không hiển thị nước hợp lệ, ô chiếu, quân bị bắt hoặc danh sách lịch sử trong ván.

### Luật đã triển khai

- **Hardcore:** trạng thái ban đầu hiện đủ quân, ẩn sau animation của nước hợp lệ đầu tiên của Trắng; không có Peek. Kết thúc ván được xem lại vị trí cuối.
- **Strategic Peeks:** mỗi người có 10 lượt. Có thể bật cả khi đối thủ đang đi. Peek không hết theo số giây, không mất khi đối thủ đi, không bị trừ khi thử nước sai. Chỉ nước hợp lệ tiếp theo của chính người bật mới tắt Peek và trừ 1.
- **60 giây/nước:** server đặt `deadline = now + 60000` khi ván bắt đầu và sau mỗi nước hợp lệ. Có timer riêng và kiểm tra deadline trước mỗi lệnh. Mốc `now >= deadline` là hết giờ. Peek, nước sai, reconnect không gia hạn. Client chỉ vẽ đồng hồ, không quyết định thắng thua.
- **Mất mạng:** giữ ván và đồng hồ; đăng nhập lại cùng tài khoản nhận snapshot hiện tại. Nếu đến lượt mà không trở lại kịp thì thua do hết giờ.
- **Luật cờ:** server dùng chess.js để xác thực lượt đi, chiếu hết, hòa hết nước, ba lần lặp, luật 50 nước và thiếu quân. Có nhập thành, en passant, phong cấp và chọn cả Hậu/Xe/Tượng/Mã.
- **Elo:** trận ghép ngẫu nhiên và trận bạn bè đều có tính điểm; bot không tính. K = 32, điểm kỳ vọng theo chênh lệch Elo. Hai người 1200: thắng +16, thua −16, hòa 0. Ván phân thắng bại có mức thay đổi tối thiểu 1, tổng thay đổi bằng 0. Kết quả trận + hai tài khoản được commit trong cùng transaction, retry không tính điểm hai lần.
- **Ghép trận:** chỉ ghép cùng chế độ. Khoảng Elo ban đầu ±100, tăng 100 mỗi 10 giây, tối đa 1200. Chọn ngẫu nhiên trong nhóm đủ điều kiện; ưu tiên người chờ lâu. Một tài khoản không thể ở hai phòng hoặc vừa tìm trận vừa chơi.
- **Party:** mã ngẫu nhiên 6 số, tự hết hạn sau 10 phút nếu chưa đủ người. Màu được chia ngẫu nhiên khi bắt đầu.
- **Stockfish:** chạy backend dưới dạng child process, lite single-thread WASM; giới hạn số ván bot đồng thời và đóng process khi kết thúc. Các mức 800/1200/1600 là nhãn luyện tập gần đúng theo `Skill Level`, độ sâu và thời gian suy nghĩ; chưa được hiệu chỉnh bằng một pool Elo thực. Lỗi engine hủy ván, không trừ Elo.

### Bàn cờ và thao tác

`ChessBoard.js` dựng 64 ô View, nhận input qua PanResponder và vẽ quân bằng SVG. Nó hỗ trợ chạm ô nguồn → ô đích, kéo thả, bàn xoay theo màu, và chọn ô bằng Enter/Space trên Web. View quân dùng **`opacity: visible ? 1 : 0`**; lớp tương tác của ô vẫn tồn tại nên vẫn di chuyển quân vô hình. Không chỉ cho chọn các ô đang có quân, tránh vô tình tiết lộ vị trí. Phong cấp dùng Modal tương thích native và web. Trên điện thoại nút Peek nằm ngay dưới bàn cờ.

### Bản nâng cấp bàn gỗ và sửa visibility

- `memoryVisibility.js` lấy số nửa nước từ `room.ply`; khi thiếu giá trị này thì suy ra từ fullmove counter và lượt đi trong FEN. `ply = 0` luôn hiện đủ quân. `ply >= 1` mới ẩn, trừ Peek đang bật hoặc màn hình kết quả. Không dùng `chess.history()` trên object vừa dựng từ FEN vì history không được khôi phục theo FEN.
- Bàn cờ có khung gỗ dày, nẹp trong, cạnh vát và bóng đổ. `WoodSurface.js` vẽ vân gỗ ổn định cho từng ô. Tọa độ kéo thả được tính trong vùng 8×8 bên trong khung.
- Quân ngọc trai và kim loại dùng SVG với gradient, phản sáng, đế tròn và bóng tiếp xúc để tạo hiệu ứng **2.5D**. Đây không phải scene 3D có camera xoay như ứng dụng macOS; cùng một renderer nhẹ chạy trên cả ba nền tảng.
- Bot cầm Trắng chờ 3 giây trước nước mở màn để người chơi kịp nhìn thế cờ ban đầu. Khoảng này nằm trong lượt 60 giây, không thêm giờ. Bot cầm Đen vẫn trả lời nước đầu của người chơi bình thường.
- Cần khởi động lại backend để áp dụng thay đổi thời gian mở màn của bot. Nếu đang dùng `dev:demo`, dữ liệu là tạm thời và mất khi dừng; dùng MongoDB lưu lâu dài theo hướng dẫn phía trên nếu cần giữ tài khoản.

### Animation và layout mới

- `ChessBoardScreen.js` dùng `useWindowDimensions()`: màn hình ngang rộng từ 760 px đặt thẻ **Nước đi cuối** và điều khiển bên trái, bàn cờ bên phải; màn hình dọc đặt thẻ trên bàn. Tỷ lệ bàn cờ luôn vuông.
- `MOVE_DURATION = 300` trong `apps/client/src/animation/boardPlayback.js` điều chỉnh thời lượng cho cả Web và native. Vì bàn cờ custom, không sử dụng prop `animationDuration` của react-chessboard.
- Web dùng CSS `transition: transform 300ms`; iOS/Android dùng Reanimated `withTiming`, `translateX` và `translateY`. Khi kéo thả, quân tiếp tục từ vị trí thả đến tâm ô, không nhảy về ô nguồn.
- Mỗi snapshot Socket.IO được xếp hàng. Bàn giữ vị trí và visibility trước nước đi trong lúc animation, chỉ áp dụng snapshot đích khi callback hoàn tất. Vì vậy Peek chỉ ẩn sau chuyển động, kể cả khi bot phản hồi rất nhanh. Nước đi vô hình vẫn chạy với `opacity: 0`. Server vẫn quyết định thời điểm trừ Peek và đồng hồ, animation không cộng thêm thời gian.
- Nhập thành di chuyển cả Vua và Xe. Bắt quân và en passant cập nhật ở cuối chuyển động; phong cấp hiển thị quân được chọn khi Tốt đến nơi. Reconnect bị thiếu nước chuyển thẳng đến snapshot đồng bộ, không dựng các nước chưa nhận.
- `SpringPressable` dùng React Native Animated: nhấn co trong 110 ms (thẻ chế độ về `scale: 0.95`, nút khác về `0.96`), thả nảy về `1` bằng spring. Chuyển động tiếp tục từ scale hiện tại khi nhấn liên tục và tự trả về kích thước gốc khi nút chuyển sang disabled/loading. `MainMenuScreen` có fade-in 420 ms mỗi lần mount. Native dùng native driver, Web dùng JS driver.

Cài lại dependencies và **build lại development client native** vì đã thêm Reanimated và Worklets:

```bash
# Từ thư mục gốc
pnpm install
pnpm dev:web
# Chọn nền tảng native cần chạy; yêu cầu bộ công cụ tương ứng:
pnpm mobile:ios
pnpm mobile:android
```

Expo preset cấu hình Worklets tự động; dự án không cần thêm Babel plugin thủ công. Tham khảo [tài liệu Reanimated của Expo](https://docs.expo.dev/versions/latest/sdk/reanimated/).

## Phạm vi triển khai

- Bản này chạy **một backend process**: phòng, hàng đợi và đồng hồ đang chơi lưu trong RAM. Tài khoản và kết quả lưu MongoDB. Restart sẽ hủy ván đang chơi không phạt Elo; kết quả đã ghi `pending` được hoàn tất Elo lúc khởi động lại. Nếu cần nhiều process/region, phải bổ sung shared state, distributed lock và Socket.IO adapter; không chỉ tăng replica server.
- CSS opacity là cơ chế gameplay theo yêu cầu, **không phải chống gian lận**: client nhận FEN để dựng bàn và kéo quân, nên người dùng công cụ phát triển có thể xem thế cờ. Hệ thống vẫn chống sửa nước đi, thời gian, danh tính và Elo phía client. Trận Elo cạnh tranh có thưởng cần thiết kế chống gian lận riêng.
- Kết quả chưa ghi được do MongoDB lỗi sẽ được retry và giữ người chơi ở trạng thái chờ lưu. Nếu process chết trong lúc database không ghi được, trạng thái chỉ còn trong RAM không thể phục hồi.
- Stockfish.js phát hành GPLv3. Xem license trong package `stockfish` khi phân phối engine. Các hình quân trong frontend là SVG tự tạo trong source.

Tài liệu API đối chiếu: [Expo Web](https://docs.expo.dev/workflow/web/), [Expo SDK](https://docs.expo.dev/versions/latest/), [PanResponder](https://reactnative.dev/docs/panresponder), [Socket.IO](https://socket.io/docs/v4/server-options/), [chess.js](https://jhlywa.github.io/chess.js/), [Stockfish.js](https://github.com/nmrugg/stockfish.js).
