// Adjusted imports: up two levels to Project/js
import { auth } from '../../Project/js/firebase-config.js';
import { deleteUser } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";
// Adjusted imports: up one level to Profile root
import { $, toggleModal, notify, setLoading } from '../profile-utils.js';

export const initAccountSettings = () => {
    $('#delete-account-btn')?.addEventListener('click', () => {
        toggleModal('delete-account-modal', true);
        $('#delete-confirm-input').value = '';
        $('#confirm-delete-btn').disabled = true;
    });
    $('#delete-confirm-input')?.addEventListener('input', (e) => {
        $('#confirm-delete-btn').disabled = (e.target.value !== 'delete my account');
    });
    $('#confirm-delete-btn')?.addEventListener('click', handleAccountDeletion);
};

async function handleAccountDeletion() {
    setLoading($('#confirm-delete-btn'), true, 'Deleting...');
    try {
        await deleteUser(auth.currentUser);
        window.location.href = '../index.html';
    } catch (error) {
        notify(error.message, 'error');
        setLoading($('#confirm-delete-btn'), false);
    }
}