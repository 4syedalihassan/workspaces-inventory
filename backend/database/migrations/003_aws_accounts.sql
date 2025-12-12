-- Create aws_accounts table for managing multiple AWS accounts
CREATE TABLE IF NOT EXISTS aws_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    account_id VARCHAR(12),
    region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    access_key_id TEXT NOT NULL,
    secret_access_key TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'pending',
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

-- Create index on is_default for quick lookups
CREATE INDEX idx_aws_accounts_default ON aws_accounts(is_default) WHERE is_default = true;

-- Create index on is_active
CREATE INDEX idx_aws_accounts_active ON aws_accounts(is_active);

-- Ensure only one default account
CREATE UNIQUE INDEX idx_aws_accounts_one_default ON aws_accounts(is_default) WHERE is_default = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_aws_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER aws_accounts_updated_at
    BEFORE UPDATE ON aws_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_aws_accounts_updated_at();
