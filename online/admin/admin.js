const token = localStorage.getItem("tb_admin_token");

if (!token) {
    window.location.href = "/admin/login";
}

async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("tb_admin_token");
            window.location.href = "/admin/login";
            return;
        }
        
        const users = await res.json();
        const tbody = document.getElementById('user-table-body');
        tbody.innerHTML = "";

        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.wins}</td>
                <td>${u.rank_points}</td>
                <td>
                    <button class="btn-delete" onclick="deleteUser(${u.id})">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('admin-status').innerText = `Managing ${users.length} users`;
    } catch (e) {
        window.location.href = "/admin/login";
    }
}

async function deleteUser(id) {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    
    const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
        loadUsers();
    } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
    }
}

document.addEventListener('DOMContentLoaded', loadUsers);