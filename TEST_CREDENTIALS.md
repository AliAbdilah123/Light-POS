# Development test credentials

These fictional accounts all use the development password `light-pos-demo`. Override it for all seed accounts with `POS_SEED_PASSWORD`; normal startup creates missing accounts but never changes an existing password hash.

| Scope | Role | Username | Development password |
| --- | --- | --- | --- |
| Global | Superadmin | `superadmin` | `light-pos-demo` |
| Harbor | Admin | `admin.harbor` | `light-pos-demo` |
| Harbor | Cashier | `cashier.harbor` | `light-pos-demo` |
| Harbor | Manager | `manager.harbor` | `light-pos-demo` |
| Harbor | Kitchen | `kitchen.harbor` | `light-pos-demo` |
| Harbor | Display | `display.harbor` | `light-pos-demo` |
| Garden | Admin | `admin.garden` | `light-pos-demo` |
| Garden | Cashier | `cashier.garden` | `light-pos-demo` |
| Garden | Manager | `manager.garden` | `light-pos-demo` |
| Garden | Kitchen | `kitchen.garden` | `light-pos-demo` |
| Garden | Display | `display.garden` | `light-pos-demo` |
| North | Admin | `admin.north` | `light-pos-demo` |
| North | Cashier | `cashier.north` | `light-pos-demo` |
| North | Manager | `manager.north` | `light-pos-demo` |
| North | Kitchen | `kitchen.north` | `light-pos-demo` |
| North | Display | `display.north` | `light-pos-demo` |
| Harbor + Garden | Manager | `manager.multi` | `light-pos-demo` |

Production refuses to create missing seed accounts unless `POS_SEED_PASSWORD` is present and at least 12 characters. Passwords, salts, and hashes are never returned by the API or rendered in the UI.
