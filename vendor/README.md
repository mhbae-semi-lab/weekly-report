# vendor/

CDN 없이 동작하도록 저장소에 넣은 외부 파일. 앱 코드는 빌드가 없고, 이 파일들만 아래 명령으로 한 번 만들어 넣었다.

| 파일 | 출처 · 버전 | 라이선스 |
|---|---|---|
| `pptxgen.bundle.js` | npm `pptxgenjs@4.0.1` 의 `dist/pptxgen.bundle.js` (JSZip 3.x 포함, `window.PptxGenJS` · `window.JSZip`) | MIT (`licenses/pptxgenjs.txt`), JSZip MIT/GPLv3 (`licenses/jszip.md`) |
| `anthropic-sdk.mjs` | npm `@anthropic-ai/sdk@1.6.0` 를 esbuild 로 ESM 한 파일로 묶음 | MIT (`licenses/anthropic-sdk-typescript.txt`) |
| `fonts/Pretendard-*.subset.woff2` | npm `pretendard@1.3.9` 의 `dist/web/static/woff2-subset` (Regular · SemiBold · Bold) | SIL OFL 1.1 (`licenses/pretendard-OFL.txt`) |

다시 만들기 (빈 폴더에서):

```
npm init -y
npm i pptxgenjs@4.0.1 @anthropic-ai/sdk@1.6.0 pretendard@1.3.9 esbuild@0.28.2
echo export { default, APIError, AuthenticationError, PermissionDeniedError, RateLimitError, BadRequestError, APIConnectionError, APIConnectionTimeoutError, APIUserAbortError, NotFoundError, InternalServerError } from "@anthropic-ai/sdk"; > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --minify --legal-comments=eof --outfile=anthropic-sdk.mjs
```
