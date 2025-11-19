/**
 * Maps display agent names to backend agent slugs
 */
export function getAgentSlug(agentName: string): string {
  const slugMap: Record<string, string> = {
    'luca': 'luca',
    'Luca': 'luca',
    'Parity': 'parity',
    'parity': 'parity',
    'Cadence': 'cadence',
    'cadence': 'cadence',
    'Forma': 'forma',
    'forma': 'forma',
    'Kanban View': 'kanban-view',
    'kanban view': 'kanban-view',
    'kanban-view': 'kanban-view',
  };

  const slug = slugMap[agentName];
  if (!slug) {
    console.warn(`[Agent] Unknown agent name: ${agentName}, using lowercase`);
    return agentName.toLowerCase().replace(/\s+/g, '-');
  }

  return slug;
}
