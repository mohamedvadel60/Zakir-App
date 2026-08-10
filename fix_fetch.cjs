const fs = require('fs');
let code = fs.readFileSync('src/lib/firebaseServices.ts', 'utf8');

code = code.replace(`        tickets = data.tickets || [];
      }`, `        tickets = data.tickets || [];
      } else if (res.status === 401) {
        throw new Error("UNAUTHORIZED");
      } else {
        throw new Error("FAILED_FETCH");
      }`);
      
// Fix catch block to throw
code = code.replace(`  } catch (err: any) {
    console.error("fetchSupportTicketsApi error:", err);
    return [];
  }`, `  } catch (err: any) {
    console.error("fetchSupportTicketsApi error:", err);
    throw err;
  }`);

fs.writeFileSync('src/lib/firebaseServices.ts', code);
