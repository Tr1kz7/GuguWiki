import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { examples, schemas } from './api-catalog.mjs'
import { groups, operations } from './api-operations.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
const json = value => JSON.stringify(value, null, 2)
const wrapped = op => !op.group.startsWith('内部') || op.group === '内部 Python → Java'
const jsonResponse = op => op.response !== 'SSE' && op.response !== 'application/pdf'
const resultResponse = op => wrapped(op) && jsonResponse(op) && op.response !== '204'
const resultErrorResponse = op => !op.group.startsWith('内部') || op.group === '内部 Python → Java'
const errorLabels = {
  VALIDATION_ERROR:'参数无效', UNAUTHENTICATED:'未登录', FORBIDDEN:'权限不足',
  NOT_FOUND:'资源不存在', CONFLICT:'状态冲突', SNAPSHOT_INVALIDATED:'快照失效',
  INTERNAL_ERROR:'服务内部错误', AUTHZ_UNAVAILABLE:'授权依赖不可用',
  FTS_UNAVAILABLE:'关键词检索不可用', VECTOR_UNAVAILABLE:'向量检索不可用',
}
const formatError = (op, error) => {
  const [status, ...labels] = error.split(/\s+/)
  if (!/^\d{3}$/.test(status)) return error
  const description = labels.map(label => errorLabels[label] ?? label).join('、')
  return resultErrorResponse(op)
    ? `HTTP ${status} = Result.code ${status}（${description}）`
    : `HTTP ${status}（${description}）`
}
const responseType = op => resultResponse(op) ? `Result（data: ${op.response === '204' ? 'null' : op.response}）` : op.response
const successStatus = op => op.response === '204' && !resultResponse(op) ? '204 No Content' : '200 OK'
const successFormat = op => op.response === '204' && !resultResponse(op) ? '无响应体' : op.response === 'SSE' ? 'text/event-stream' : op.response === 'application/pdf' ? 'application/pdf' : 'application/json'
const successType = op => op.response === '204' && !resultResponse(op) ? '无' : responseType(op)
const responseValue = op => {
  if (op.responseExample) return op.responseExample
  if (op.response === '204') return null
  if (op.response === 'application/pdf') return '<PDF binary stream>'
  if (op.response === 'SSE') return 'id: run-1:1\nevent: session\ndata: {"eventId":"run-1:1","runId":"run-1","conversationId":"conversation-1","messageId":"message-2","createdAt":"2026-10-10T09:00:00Z","type":"session","status":"RUNNING"}\n\nid: run-1:2\nevent: delta\ndata: {"eventId":"run-1:2","runId":"run-1","conversationId":"conversation-1","messageId":"message-2","createdAt":"2026-10-10T09:00:01Z","type":"delta","text":"JVM 是 Java 虚拟机。"}\n\nid: run-1:3\nevent: done\ndata: {"eventId":"run-1:3","runId":"run-1","conversationId":"conversation-1","messageId":"message-2","createdAt":"2026-10-10T09:00:02Z","type":"done","status":"COMPLETED","content":"JVM 是 Java 虚拟机。"}'
  if (op.response.endsWith('[]')) return [examples[op.response.slice(0,-2)]]
  return examples[op.response]
}
const schemaRows = op => {
  if (resultResponse(op)) {
    const prefix = [['code','number','是','成功为 200；失败时与 HTTP 状态码相同'],['data',op.response === '204' ? 'null' : op.response,'是','业务数据；无数据时为 null'],['message','string | null','是','本次操作的反馈信息；无反馈时可为 null 或空字符串']]
    if (op.response === '204') return prefix
    const list = op.response.endsWith('[]')
    const name = list ? op.response.slice(0,-2) : op.response
    const loginToken = op.title === '登录' ? [['token','string','是','随机登录凭证；仅登录成功响应返回，前端后续放在 Authorization 请求头']] : []
    return [...prefix,...loginToken,...(schemas[name] ?? []).map(([field,type,required,note]) => [list ? `data[].${field}` : `data.${field}`,type,required,note])]
  }
  if (op.response === '204') return [['—','—','—','无响应体']]
  if (op.response === 'application/pdf') return [['body','binary','是','Content-Type: application/pdf；授权后返回原件']]
  if (op.response === 'SSE') return [['eventId','string','是','SSE id 与 JSON eventId 相同'],['runId','string','是','生成任务 ID'],['conversationId','string','是','会话 ID'],['messageId','string','是','助手消息 ID'],['createdAt','ISO 8601','是','事件时间'],['type','session | citation | delta | done | error | cancel_requested | cancelled','是','事件类型'],['citation / text / content / status / code / message','按事件类型','否','见下文 SSE 事件结构']]
  const list = op.response.endsWith('[]')
  const name = list ? op.response.slice(0,-2) : op.response
  return (schemas[name] ?? []).map(([field,type,required,note]) => [list ? `items[].${field}` : field,type,required,note])
}
const samplePath = op => {
  if (op.title === '下载 PDF 原件') return '/api/v1/documents/doc-pdf/original'
  const ids = {id:op.path.includes('conversations')?'conversation-1':op.path.includes('/retrieval/runs/')?'run-1':op.path.includes('publish-jobs')?'publish-1':op.path.includes('imports')?'import-1':op.path.includes('evaluation')?'evaluation-1':op.path.includes('knowledge-bases')?'kb-java':op.path.includes('users')?'user-reader':'doc-jvm',runId:'run-1'}
  let path = op.path.replace(/\{(\w+)\}/g,(_,key)=>ids[key] ?? `${key}-1`)
  const queries = op.params.filter(row => row[0] === 'Query')
  if (queries.length) path += '?' + queries.map(([,name])=>`${name}=${name === 'q'?'JVM':'kb-java'}`).join('&')
  return path
}
const requestText = op => {
  const lines = [`${op.method} ${samplePath(op)} HTTP/1.1`]
  if (!op.group.startsWith('内部') && op.title !== '登录') lines.push('Authorization: <登录 Token>')
  if (op.group.startsWith('内部')) lines.push('Authorization: Bearer <服务凭据>')
  if (op.response === 'SSE' && op.method === 'GET') lines.push('Accept: text/event-stream')
  if (op.body !== undefined) {
    lines.push(`Content-Type: ${op.contentType ?? 'application/json'}`,'',op.contentType === 'multipart/form-data' ? '<multipart fields and binary file>' : json(op.body))
  }
  return lines.join('\n')
}
const responseText = op => {
  if (op.response === '204' && !resultResponse(op)) return 'HTTP/1.1 204 No Content'
  const contentType = op.response === 'SSE' ? 'text/event-stream' : op.response === 'application/pdf' ? 'application/pdf' : 'application/json'
  const value = resultResponse(op) ? {code:op.response === '204' ? 204 : 200,data:responseValue(op),message:op.successMessage ?? '',...(op.title === '登录' ? {token:'<随机登录 Token>'} : {})} : responseValue(op)
  return `HTTP/1.1 200 OK\nContent-Type: ${contentType}\n\n${typeof value === 'string' ? value : json(value)}`
}
const policy = [
  ['统一响应','Java 对外普通 JSON 接口成功时返回 HTTP 200 和 Result.code=200；失败时 HTTP 状态码与 Result.code 使用相同数字（如 HTTP 401 对应 code=401），响应体为 {code,data:null,message}。code 是数字状态码，message 提供用户可读提示。成功但无响应体的操作（如退出登录、删除会话）返回 HTTP 204，不返回 Result。PDF 原件和 SSE 成功响应使用各自格式；这些接口发生错误时仍返回 JSON Result，且 HTTP 状态与 code 一致。Python 服务的 JSON 响应不使用 Java Result。'],
  ['密码与登录态','本地管理员测试数据使用 BCrypt 哈希后写入 users.password_hash；未来创建用户时也须使用同一方案。登录时按邮箱查账号并用 BCrypt.verify 校验，不能再次 hash 后比较字符串。登录成功生成高熵随机 Token，Redis 的 login:token:{token} 只存 userId，TTL 为 30 分钟；请求携带 Authorization: <登录 Token>。恢复拦截器查 Redis、确认数据库账号仍启用并刷新 TTL；登录拦截器拒绝未登录业务请求。公开登录页面由前端路由提供，POST /auth/login 放行。请求完成清理 ThreadLocal，退出登录删除 Redis 键。管理员接口还要校验 ADMIN，资源接口还要校验归属和当前权限。'],
  ['授权候选检索','读者的检索范围为全部已发布文档；管理员可查看草稿并管理全部内容。FTS 与 pgvector 两路 SQL 均须先限定 active_version_id 有效的已发布文档，再排序并截取 Top-K。禁止取全局固定 Top-K 后过滤。权限服务故障直接返回 HTTP 503 / code 503。'],
  ['降级与弃答','仅单路召回故障且另一条链路授权成功、达到该路独立阈值、最少有效证据数与启用的覆盖判断时降级。FTS、向量、重排分数不能共用阈值；证据不足返回“知识库中没有足够的信息。”，不调用生成模型补全内部知识。'],
  ['版本与撤权','文档新版本索引成功后，Java 原子切换 active_version_id。失败保留旧版，并拒绝同文档并发发布。下架或切换生效版本后，在线浏览、检索、PDF 和引用立即按新生效版本处理；历史回答中不再可访问的引用应隐藏，用户问题和审计保留。'],
  ['实验快照','快照冻结已发布文档版本、切片/索引及语料指纹、数据集标注、模型环境；每次运行冻结全部检索参数与逐查询结果。运行中语料或标注变化可使快照失效；读取结果再次校验可访问的发布版本，在线检索不能用实验快照绕过发布状态。'],
  ['SSE 与取消','每个事件都带 eventId、runId、conversationId、messageId、createdAt、type；SSE id 等于 eventId。取消经过 RUNNING → CANCEL_REQUESTED → CANCELLED；Java 保存已产生文本并通知 Python 协作停止。若先完成则保持 COMPLETED；前端轮询运行状态确认终态。'],
  ['内部信任边界','Python 不接收用户 ID、角色或 Cookie，只持有短期随机 scopeToken。Java 每次检索均校验 scopeToken 与发布状态；内部服务凭据与 scopeToken 都必须验证。'],
]
const errorRows = [
  ['400','参数或导入格式无效','校验失败'],['401','未登录或会话过期','需要重新登录'],['403','权限不足','角色、文档或会话权限不足'],['404','资源不存在','也可用于隐藏资源存在性'],['409','状态冲突','修订号或快照冲突'],['500','服务内部错误','请求未完成'],['503','依赖服务不可用','必须拒绝或按规则降级'],['200','证据不足','请求成功，但返回固定弃答文本'],
]
const tableMd = (headers,rows) => `| ${headers.join(' | ')} |\n| ${headers.map(()=> '---').join(' | ')} |\n${rows.map(row=>`| ${row.map(value=>String(value).replaceAll('|','\\|').replaceAll('\n',' ')).join(' | ')} |`).join('\n')}`
const codeMd = (value,lang='text') => `\n\`\`\`${lang}\n${value}\n\`\`\`\n`
const htable = (headers,rows) => `<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
const hcode = value => `<pre><code>${esc(value)}</code></pre>`

let md = `# GuguWiki 接口文档（逐接口详细版）\n\n> 按实现依赖和页面操作列出接口。示例是契约，不代表全部接口已经运行；当前 Java 仅实现认证链路。前端契约见 \`frontend/src/contracts.ts\`，HTTP 适配器见 \`frontend/src/api/http.ts\`。\n\n## 阅读约定\n\n前六组是 **React → Java 对外接口**，后两组是 **Java ↔ Python 内部接口**。字段名采用 camelCase；ID 为不透明字符串；时间为 ISO 8601 UTC。Java 普通 JSON 响应统一使用 \`{code,data,message,token?}\`；失败时 HTTP 状态码与 \`code\` 相同；HTTP 204 无响应体，PDF、SSE 和 Python 服务响应遵循各自格式。\n\n## 建议实现顺序（先读）\n\n1. **先准备密码能力和首个管理员账号。** \`users.password_hash\` 只存 BCrypt 哈希。仅在本地开发时，显式运行 \`AdminSeedTest\` 创建首个管理员；它不是应用启动逻辑，不会在普通测试中运行。不要把明文密码或固定哈希写进迁移、示例和日志。\n2. **实现认证三接口。** 登录按邮箱查出 \`password_hash\`、\`enabled\` 和角色；用 \`BCrypt.verifyer().verify(明文密码, 已存哈希)\` 判断，不能重新 hash 明文后比较两串哈希。成功后创建随机 Token，Redis 保存 \`userId\` 和 30 分钟 TTL。\n3. **实现拦截器。** 恢复拦截器读取 \`Authorization: <登录 Token>\`、查 Redis、查仍启用的用户、保存到 ThreadLocal 并续期；登录拦截器仅保护 \`/api/**\`，排除公开登录接口。处理结束清理 ThreadLocal。未登录可以打开前端登录页，访问需登录 API 返回 401。\n4. **后续业务接口按需实现。** [管理员创建用户](#op-2-1)目前只是接口契约，不属于已实现的认证链路；实现时须用相同的 BCrypt 方案哈希 \`initialPassword\`。\n\n\`code\` 与 HTTP 状态对齐：JSON 成功为 HTTP 200 / code 200，失败如 HTTP 401 / code 401；HTTP 204 没有 Result 响应体。\n\n## 接口目录\n\n`
md = md.replace('## 接口目录', '### 本地开发管理员测试数据\n\n`AdminSeedTest` 只在显式设置 `GUGUWIKI_SEED_ADMIN=true`、`GUGUWIKI_SEED_ADMIN_EMAIL` 和 `GUGUWIKI_SEED_ADMIN_PASSWORD`（至少 8 位）并单独运行该测试时，向尚无 ADMIN 的本地数据库写入一个 BCrypt 哈希后的管理员账号。应用启动和普通测试不会自动创建账号；数据库迁移也不插入演示账号。\n\n当前 Java 仅实现认证链路；创建用户与其他业务接口仍是待实现契约。\n\n## 接口目录')
let htmlNav = ''
let htmlMain = `<section class="intro"><h1>GuguWiki 接口文档</h1><p>按实现依赖和页面操作查看接口。前六组是 React → Java；后两组是 Java ↔ Python 内部接口。</p><p class="notice">当前 Java 仅实现认证链路；创建用户与其他业务接口是待实现契约。</p><h2>建议实现顺序</h2><ol><li>准备 BCrypt 密码能力；本地开发需要首个管理员时，显式运行 AdminSeedTest。</li><li>登录查询 password_hash，用 BCrypt.verify 校验，成功后生成 Redis Token。</li><li>恢复拦截器读取 Token、核验账号并续期；登录拦截器仅保护业务 API，处理结束清理 ThreadLocal。</li><li>后续业务接口按需实现；创建用户目前仅是接口契约。</li></ol><p>JSON 成功为 HTTP 200 / code 200；失败状态与 code 相同；HTTP 204 没有 Result 响应体。</p></section>`
htmlMain += `<section class="rule"><h3>本地开发管理员测试数据</h3><p>仅显式设置 GUGUWIKI_SEED_ADMIN=true、GUGUWIKI_SEED_ADMIN_EMAIL、GUGUWIKI_SEED_ADMIN_PASSWORD 后单独运行 AdminSeedTest，才会在尚无 ADMIN 的本地数据库中创建管理员。应用启动和普通测试不会自动创建账号。</p></section>`
let count = 0
groups.forEach((group,groupIndex)=>{
  const ops = operations.filter(op=>op.group===group.name)
  const number = groupIndex+1
  md += `### ${number}. ${group.name}\n\n`
  htmlNav += `<div class="nav-group"><a class="nav-group-title" href="#group-${number}">${number}. ${esc(group.name)}</a>`
  ops.forEach((op,opIndex)=>{
    count++
    const n=`${number}.${opIndex+1}`
    const id=`op-${number}-${opIndex+1}`
    md += `- [${n} ${op.title} · ${op.method} ${op.path}](#${id})\n`
    htmlNav += `<a class="nav-item" href="#${id}"><span>${n} ${esc(op.title)}</span><b class="method ${op.method.toLowerCase()}">${op.method}</b></a>`
  })
  md+='\n'
  htmlNav+='</div>'
})
md += '- [通用数据结构](#schemas)\n- [HTTP 状态码与关键业务规则](#rules)\n\n'
htmlNav += '<div class="nav-group"><a class="nav-group-title" href="#schemas">通用数据结构</a><a class="nav-group-title" href="#rules">HTTP 状态码与业务规则</a></div>'

groups.forEach((group,groupIndex)=>{
  const ops = operations.filter(op=>op.group===group.name)
  const number = groupIndex+1
  md += `## ${number}. ${group.name}\n\n**鉴权：**${group.auth}。\n\n`
  htmlMain += `<section class="group" id="group-${number}"><h2>${number}. ${esc(group.name)}</h2><p>${esc(group.auth)}</p></section>`
  ops.forEach((op,opIndex)=>{
    const n=`${number}.${opIndex+1}`
    const id=`op-${number}-${opIndex+1}`
    const auth=op.auth ?? group.auth
    const params=op.params.length?op.params:[['—','—','—','—','无业务参数']]
    const fields=schemaRows(op)
    md += `<a id="${id}"></a>\n\n### ${n} ${op.title}\n\n#### ${n}.1 基本信息\n\n- **请求路径：**\`${op.path}\`\n- **请求方式：**\`${op.method}\`\n- **鉴权：**${auth}\n- **接口描述：**${op.description}\n\n#### ${n}.2 请求参数\n\n${tableMd(['位置','参数名','类型','是否必须','备注'],params)}\n\n请求示例：${codeMd(requestText(op),'http')}\n#### ${n}.3 响应数据\n\n- **成功状态：**\`${successStatus(op)}\`；**格式：**\`${successFormat(op)}\`；**类型：**\`${successType(op)}\`。\n\n${tableMd(['参数名','类型','是否必须','备注'],fields)}\n\n响应示例：${codeMd(responseText(op),op.response === 'SSE'?'text':'http')}\n**主要错误：**${op.errors.map(x=>`\`${formatError(op,x)}\``).join('、')}。\n\n`
    htmlMain += `<article class="operation" id="${id}"><div class="op-heading"><span class="method ${op.method.toLowerCase()}">${esc(op.method)}</span><div><small>${n} ${esc(group.name)}</small><h3>${esc(op.title)}</h3></div></div><h4>${n}.1 基本信息</h4>${htable(['项目','内容'],[['请求路径',op.path],['请求方式',op.method],['鉴权',auth],['接口描述',op.description]])}<h4>${n}.2 请求参数</h4>${htable(['位置','参数名','类型','是否必须','备注'],params)}<p class="sample-label">请求示例</p>${hcode(requestText(op))}<h4>${n}.3 响应数据</h4><p><strong>${successStatus(op)}</strong> · ${esc(successType(op))} · ${esc(successFormat(op))}</p>${htable(['参数名','类型','是否必须','备注'],fields)}<p class="sample-label">响应示例</p>${hcode(responseText(op))}<p class="errors"><strong>主要错误：</strong>${esc(op.errors.map(x=>formatError(op,x)).join('、'))}</p></article>`
  })
})

md += `<a id="schemas"></a>\n\n## 通用数据结构\n\n上文每个接口的响应字段表已列出对应 DTO。此处补充嵌套类型，便于 Java/Python 分别建模。\n\n`
htmlMain += `<section class="group" id="schemas"><h2>通用数据结构</h2><p>接口响应字段表中的嵌套 DTO 在这里完整列出。</p></section>`
for (const [name,rows] of Object.entries(schemas)) {
  md += `### ${name}\n\n${tableMd(['字段','类型','必填','说明'],rows)}\n\n`
  htmlMain += `<section class="schema"><h3>${esc(name)}</h3>${htable(['字段','类型','必填','说明'],rows)}</section>`
}
md += `<a id="rules"></a>\n\n## HTTP 状态码与关键业务规则\n\n${tableMd(['HTTP 状态 = Result.code','场景','说明'],errorRows)}\n\n`
htmlMain += `<section class="group" id="rules"><h2>HTTP 状态码与关键业务规则</h2>${htable(['HTTP 状态 = Result.code','场景','说明'],errorRows)}</section>`
for (const [title,content] of policy) {
  md += `### ${title}\n\n${content}\n\n`
  htmlMain += `<section class="rule"><h3>${esc(title)}</h3><p>${esc(content)}</p></section>`
}
md += `### 状态枚举\n\n- \`RunStatus\`：\`RUNNING\`、\`CANCEL_REQUESTED\`、\`CANCELLED\`、\`COMPLETED\`、\`FAILED\`。\n- \`JobStatus\`：\`PENDING\`、\`RUNNING\`、\`SUCCEEDED\`、\`FAILED\`、\`INVALIDATED\`。\n- HTTP 模式没有 Mock 场景切换、重置接口；这两项只存在于浏览器 Mock 适配器。\n\n`
htmlMain += `<section class="rule"><h3>状态枚举与 Mock</h3><p>RunStatus：RUNNING、CANCEL_REQUESTED、CANCELLED、COMPLETED、FAILED。JobStatus：PENDING、RUNNING、SUCCEEDED、FAILED、INVALIDATED。Mock 场景切换和重置不是 HTTP 接口。</p></section>`

const style = `:root{font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;color:#1e293b;background:#f7f9fc}*{box-sizing:border-box}body{margin:0}.layout{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:100vh}.sidebar{position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid #dce4ef;background:#fff;padding:22px 14px}.brand{display:flex;gap:10px;align-items:center;padding:5px 9px 22px;color:#1d4ed8;font-weight:800}.brand i{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#e8efff;font-style:normal}.nav-group{display:grid;gap:3px;margin:7px 0 16px}.nav-group-title{font-weight:750;color:#334155;padding:10px 9px}.nav-item{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;padding:7px 9px;border-radius:7px;color:#64748b}.nav-item:hover,.nav-item:focus{background:#edf3ff;color:#1d4ed8}.nav-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}a{text-decoration:none;color:inherit}.method{font-family:ui-monospace,monospace;font-weight:800;font-size:10px;border-radius:5px;padding:4px 6px;background:#dbeafe;color:#1d4ed8}.method.post{background:#def7ec;color:#047857}.method.put,.method.patch{background:#fef3c7;color:#a16207}.method.delete{background:#fee2e2;color:#b91c1c}main{min-width:0;max-width:1250px;padding:35px 42px 100px}.intro{padding:8px 0 30px}.intro h1{font-size:29px;color:#172554}.intro p{color:#64748b}.intro .notice{padding:12px 15px;background:#eff6ff;border-left:3px solid #3b82f6;border-radius:5px}.group{scroll-margin-top:15px;margin:30px 0 14px;padding-top:18px;border-top:1px solid #e2e8f0}.group h2{color:#1e40af}.group p{color:#64748b}.operation{scroll-margin-top:18px;background:white;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 3px 14px #233b5f0a;padding:25px 30px;margin:17px 0;overflow-x:auto}.op-heading{display:flex;gap:12px;align-items:center}.op-heading .method{font-size:12px;padding:6px 9px}.op-heading small{color:#94a3b8}.op-heading h3{margin:3px 0 0;font-size:20px;color:#172554}h4{font-size:15px;color:#1d4ed8;margin:27px 0 12px}table{border-collapse:collapse;width:100%;font-size:12px;margin:12px 0 18px;table-layout:auto}th,td{border:1px solid #dce4ef;padding:9px 10px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f1f5f9;color:#334155}td:first-child{font-family:ui-monospace,monospace;color:#334155}.sample-label{font-weight:700;font-size:12px;color:#475569}pre{background:#f3f5f8;border:1px solid #e2e8f0;border-radius:8px;padding:17px;overflow:auto;font-size:12px;line-height:1.55;color:#334155}.errors{font-size:12px;color:#64748b}.schema,.rule{scroll-margin-top:20px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px 25px;margin:14px 0}.schema h3,.rule h3{color:#1d4ed8}.rule p{line-height:1.8;color:#475569}@media(max-width:900px){main{padding:20px 18px 70px}.operation{padding:18px 14px}table{font-size:11px}}@media(max-width:650px){.layout{grid-template-columns:1fr}.sidebar{position:relative;height:auto;max-height:240px;border-right:0;border-bottom:1px solid #e2e8f0}.sidebar nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}}`
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GuguWiki 接口文档</title><style>${style}</style></head><body><div class="layout"><aside class="sidebar"><a class="brand" href="#top"><i>g</i>GuguWiki · 接口文档</a><nav>${htmlNav}</nav></aside><main id="top">${htmlMain}<footer>GuguWiki · ${count} 个接口 · 与 frontend/src/api/http.ts 对齐</footer></main></div></body></html>`
writeFileSync(resolve(here,'接口文档.md'),md,'utf8')
const htmlDir=resolve(root,'frontend','public','api-docs')
mkdirSync(htmlDir,{recursive:true})
writeFileSync(resolve(htmlDir,'index.html'),html,'utf8')
console.log(`Generated ${count} API entries in docs/接口文档.md and frontend/public/api-docs/index.html`)
