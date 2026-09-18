export function officeMode(project, place = 'work', activity = '') {
  if (project.delivered) return 'leaving';
  if (activity === 'support' || activity === 'intro') return 'talking';
  if (place === 'coffee') return 'coffee';
  if (place === 'meeting') return 'talking';
  return project.accepted ? 'typing' : 'arriving';
}
export function officeCast(people, partnerId) {
  const partner = people.find(p => p.id === partnerId);
  return [...(partner ? [partner] : []), ...people.filter(p => p.id !== partner?.id)].slice(0, 3);
}
