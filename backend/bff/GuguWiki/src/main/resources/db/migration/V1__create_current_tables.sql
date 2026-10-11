-- 用户信息表：保存登录账号、密码哈希和服务端角色。
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('READER', 'ADMIN')),
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_email_not_blank CHECK (length(btrim(email)) > 0),
    CONSTRAINT users_display_name_not_blank CHECK (length(btrim(display_name)) > 0)
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

-- 知识库表：组织目录和文档的顶层空间。
CREATE TABLE knowledge_bases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    icon text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT knowledge_bases_name_not_blank CHECK (length(btrim(name)) > 0)
);

-- 目录表：父目录必须属于同一个知识库。
CREATE TABLE folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id uuid NOT NULL REFERENCES knowledge_bases (id) ON DELETE RESTRICT,
    parent_id uuid,
    title text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT folders_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT folders_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT folders_knowledge_base_id_id_uq UNIQUE (knowledge_base_id, id),
    CONSTRAINT folders_parent_same_knowledge_base_fk
        FOREIGN KEY (knowledge_base_id, parent_id)
        REFERENCES folders (knowledge_base_id, id) ON DELETE RESTRICT
);
CREATE INDEX folders_parent_idx ON folders (knowledge_base_id, parent_id);

-- 文档表：保存管理员草稿；active_version_id 指向读者可见的发布版本。
CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_base_id uuid NOT NULL REFERENCES knowledge_bases (id) ON DELETE RESTRICT,
    parent_id uuid,
    title text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('MARKDOWN', 'PDF')),
    summary text NOT NULL DEFAULT '',
    draft_content text NOT NULL DEFAULT '',
    draft_revision bigint NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
    original_file_name text,
    original_storage_key text,
    active_version_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT documents_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT documents_pdf_file_pair CHECK (
        (original_file_name IS NULL AND original_storage_key IS NULL)
        OR (original_file_name IS NOT NULL AND original_storage_key IS NOT NULL)
    ),
    CONSTRAINT documents_parent_same_knowledge_base_fk
        FOREIGN KEY (knowledge_base_id, parent_id)
        REFERENCES folders (knowledge_base_id, id) ON DELETE RESTRICT
);
CREATE INDEX documents_parent_idx ON documents (knowledge_base_id, parent_id);
CREATE INDEX documents_active_version_idx ON documents (active_version_id)
    WHERE active_version_id IS NOT NULL;

-- 文档版本表：保存不可变的发布内容及 PDF 原件信息。
CREATE TABLE document_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents (id) ON DELETE RESTRICT,
    version_number integer NOT NULL CHECK (version_number > 0),
    title text NOT NULL,
    summary text NOT NULL DEFAULT '',
    content text NOT NULL,
    original_file_name text,
    original_storage_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    indexed_at timestamptz NOT NULL,
    CONSTRAINT document_versions_title_not_blank CHECK (length(btrim(title)) > 0),
    CONSTRAINT document_versions_number_uq UNIQUE (document_id, version_number),
    CONSTRAINT document_versions_document_id_id_uq UNIQUE (document_id, id),
    CONSTRAINT document_versions_pdf_file_pair CHECK (
        (original_file_name IS NULL AND original_storage_key IS NULL)
        OR (original_file_name IS NOT NULL AND original_storage_key IS NOT NULL)
    )
);
CREATE INDEX document_versions_document_created_idx
    ON document_versions (document_id, created_at DESC);

-- 生效版本必须属于同一篇文档；版本表建好后再添加循环引用外键。
ALTER TABLE documents ADD CONSTRAINT documents_active_version_same_document_fk
    FOREIGN KEY (id, active_version_id)
    REFERENCES document_versions (document_id, id) ON DELETE RESTRICT;
