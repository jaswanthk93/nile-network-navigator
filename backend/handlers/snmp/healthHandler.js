
/**
 * Health check endpoint for backend connectivity testing
 */
exports.health = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    message: 'SNMP backend agent is running'
  });
};
