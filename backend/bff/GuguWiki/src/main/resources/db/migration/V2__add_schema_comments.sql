-- PostgreSQL 数据库工具中显示的表、字段说明。

COMMENT ON TABLE users IS '用户信息表；账号、密码哈希、角色和启用状态由 Java 管理。';
COMMENT ON COLUMN users.id IS '用户 UUID。';
COMMENT ON COLUMN users.email IS '登录邮箱；按小写形式建立唯一索引。';
COMMENT ON COLUMN users.display_name IS '显示名称。';
COMMENT ON COLUMN users.password_hash IS '密码哈希，不保存明文。';
COMMENT ON COLUMN users.role IS 'READER 读者或 ADMIN 管理员。';
COMMENT ON COLUMN users.enabled IS '账号是否启用。';
COMMENT ON COLUMN users.created_at IS '创建时间。';
COMMENT ON COLUMN users.updated_at IS '最近修改时间。';

COMMENT ON TABLE knowledge_bases IS '知识库表；组织目录和文档的顶层空间。';
COMMENT ON COLUMN knowledge_bases.id IS '知识库 UUID。';
COMMENT ON COLUMN knowledge_bases.name IS '知识库名称。';
COMMENT ON COLUMN knowledge_bases.description IS '知识库说明。';
COMMENT ON COLUMN knowledge_bases.icon IS '前端展示字符。';
COMMENT ON COLUMN knowledge_bases.created_at IS '创建时间。';
COMMENT ON COLUMN knowledge_bases.updated_at IS '最近修改时间。';

COMMENT ON TABLE folders IS '目录表；父目录必须属于同一知识库。';
COMMENT ON COLUMN folders.id IS '目录 UUID。';
COMMENT ON COLUMN folders.knowledge_base_id IS '所属知识库 ID。';
COMMENT ON COLUMN folders.parent_id IS '父目录 ID；NULL 表示根目录。';
COMMENT ON COLUMN folders.title IS '目录名称。';
COMMENT ON COLUMN folders.created_at IS '创建时间。';
COMMENT ON COLUMN folders.updated_at IS '最近修改时间。';

COMMENT ON TABLE documents IS '文档表；保存管理员草稿和当前生效版本指针。';
COMMENT ON COLUMN documents.id IS '文档 UUID。';
COMMENT ON COLUMN documents.knowledge_base_id IS '所属知识库 ID。';
COMMENT ON COLUMN documents.parent_id IS '所属目录 ID；NULL 表示根目录。';
COMMENT ON COLUMN documents.title IS '草稿标题；读者读取生效版本标题。';
COMMENT ON COLUMN documents.kind IS 'MARKDOWN 或 PDF。';
COMMENT ON COLUMN documents.summary IS '草稿摘要；读者读取生效版本摘要。';
COMMENT ON COLUMN documents.draft_content IS '管理员草稿正文。';
COMMENT ON COLUMN documents.draft_revision IS '草稿乐观锁修订号。';
COMMENT ON COLUMN documents.original_file_name IS 'PDF 草稿原件文件名。';
COMMENT ON COLUMN documents.original_storage_key IS 'PDF 草稿原件受控存储键。';
COMMENT ON COLUMN documents.active_version_id IS '当前生效版本 ID；NULL 表示未发布。';
COMMENT ON COLUMN documents.created_at IS '创建时间。';
COMMENT ON COLUMN documents.updated_at IS '最近修改时间。';

COMMENT ON TABLE document_versions IS '文档版本表；保存不可变的发布内容。';
COMMENT ON COLUMN document_versions.id IS '发布版本 UUID。';
COMMENT ON COLUMN document_versions.document_id IS '所属文档 ID。';
COMMENT ON COLUMN document_versions.version_number IS '同一文档内递增的版本号。';
COMMENT ON COLUMN document_versions.title IS '发布时冻结的标题。';
COMMENT ON COLUMN document_versions.summary IS '发布时冻结的摘要。';
COMMENT ON COLUMN document_versions.content IS '发布时冻结的正文或 PDF 提取文本。';
COMMENT ON COLUMN document_versions.original_file_name IS '该版本 PDF 原件文件名。';
COMMENT ON COLUMN document_versions.original_storage_key IS '该版本 PDF 原件受控存储键。';
COMMENT ON COLUMN document_versions.created_at IS '版本创建时间。';
COMMENT ON COLUMN document_versions.indexed_at IS '索引成功时间。';
