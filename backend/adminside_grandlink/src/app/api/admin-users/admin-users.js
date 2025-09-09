// Example for user-accounts/page.tsx
useEffect(() => {
  const fetchUsers = async () => {
    const res = await fetch("/api/admin-users");
    const result = await res.json();
    if (res.ok) {
      setUsers(result.users); // <-- Make sure this is set
    } else {
      setMessage("Error fetching users: " + (result.error || "Unknown error"));
    }
  };
  fetchUsers();
}, []);