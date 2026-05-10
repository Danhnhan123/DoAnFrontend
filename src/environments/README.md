# environments/ — Cấu hình môi trường

## Các file

| File                         | Môi trường  | Được dùng khi                                          |
| ---------------------------- | ----------- | ------------------------------------------------------ |
| `environment.ts`             | Production  | `ng build` hoặc `ng build --configuration production`  |
| `environment.development.ts` | Development | `ng serve` hoặc `ng build --configuration development` |

## Cấu hình thay thế (File replacement)

Angular CLI tự động thay thế `environment.ts` bằng `environment.development.ts` khi build development (xem `angular.json` → `fileReplacements`).

## Nội dung

```typescript
export const environment = {
  baseUrl: "https://your-api-domain.com/api",
};
```

- `baseUrl`: URL gốc của backend API. Tất cả các service đều dùng biến này thay vì hardcode URL.

## Cách dùng trong service

```typescript
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class UserService {
  private readonly base = environment.baseUrl;
  // → 'https://your-api-domain.com/api'
}
```

> **Lưu ý bảo mật:** Không đặt API keys hay secrets vào file environment vì chúng sẽ được bundle vào JavaScript client-side.
