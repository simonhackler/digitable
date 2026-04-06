import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
import Trigger from '$lib/components/ui/alert-dialog/alert-dialog-trigger.svelte';
import Title from '$lib/components/ui/alert-dialog/alert-dialog-title.svelte';
import Action from '$lib/components/ui/alert-dialog/alert-dialog-action.svelte';
import Cancel from '$lib/components/ui/alert-dialog/alert-dialog-cancel.svelte';
import Footer from '$lib/components/ui/alert-dialog/alert-dialog-footer.svelte';
import Header from '$lib/components/ui/alert-dialog/alert-dialog-header.svelte';
import Overlay from '$lib/components/ui/alert-dialog/alert-dialog-overlay.svelte';
import Content from '$lib/components/ui/alert-dialog/alert-dialog-content.svelte';
import Description from '$lib/components/ui/alert-dialog/alert-dialog-description.svelte';

const Root = AlertDialogPrimitive.Root;
const Portal = AlertDialogPrimitive.Portal;

export {
	Root,
	Title,
	Action,
	Cancel,
	Portal,
	Footer,
	Header,
	Trigger,
	Overlay,
	Content,
	Description,
	//
	Root as AlertDialog,
	Title as AlertDialogTitle,
	Action as AlertDialogAction,
	Cancel as AlertDialogCancel,
	Portal as AlertDialogPortal,
	Footer as AlertDialogFooter,
	Header as AlertDialogHeader,
	Trigger as AlertDialogTrigger,
	Overlay as AlertDialogOverlay,
	Content as AlertDialogContent,
	Description as AlertDialogDescription
};
