// Node: Attach Ticket
// Puts the ticket ID back onto the email's state for the audit log.
const s = $('Needs Ticket?').first(0).json;
const t = $('Build Ticket').first().json;
const existed = $('Read Tickets').all().some((i) => i.json && i.json.ticket_id === t.ticket_id);
return [{ json: { ...s, ticket_id: t.ticket_id, ticket_action: existed ? 'updated' : 'created' } }];
