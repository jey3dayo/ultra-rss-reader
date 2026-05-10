-- destructive-migration: removes duplicate pending mutations before adding the uniqueness contract.
DELETE FROM pending_mutations
WHERE id NOT IN (
    SELECT MIN(id)
    FROM pending_mutations
    GROUP BY account_id, mutation_type, remote_entry_id
);

CREATE UNIQUE INDEX idx_pending_mutations_unique_entry_type
    ON pending_mutations(account_id, mutation_type, remote_entry_id);

DELETE FROM schema_version;
INSERT INTO schema_version (version) VALUES (18);
