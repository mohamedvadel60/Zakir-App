const fs = require('fs');

let serverTs = fs.readFileSync('server.ts', 'utf8');

serverTs = serverTs.replace(
  /success: boolean;\s+messageId\?: string;\s+error\?: any;\s+\}> \{/g,
  `success: boolean;
  messageId?: string;
  error?: any;
  userFriendlyMessage?: string;
  provider?: string;
  sender?: string;
}> {`
);

fs.writeFileSync('server.ts', serverTs);
console.log('Fixed return type');
