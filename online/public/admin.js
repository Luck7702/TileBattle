const token = localStorage.getItem("tb_token");

async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Unauthorized access");
        
        const users = await res.json();
        const tbody = document.getElementById('user-table-body');
        tbody.innerHTML = "";

        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.username} ${u.is_admin ? '<span class="badge">ADMIN</span>' : ''}</td>
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
        window.location.href = "/lobby";
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