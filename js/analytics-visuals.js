'use strict';

(function (root) {
	function mountRevenueChart(container, months) {
		if (!root.THREE) {
			container.textContent = 'The 3D analytics library could not be loaded.';
			return () => {};
		}

		const THREE = root.THREE;
		let renderer;
		try {
			renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		} catch (error) {
			console.error('Could not initialize the 3D analytics chart.', error);
			container.textContent = '3D visualization is unavailable on this device.';
			return () => {};
		}

		const scene = new THREE.Scene();
		scene.background = new THREE.Color('#ffffff');
		const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
		camera.position.set(0, 8.5, 17);
		camera.lookAt(0, 2, 0);
		renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.setClearColor(0xffffff, 1);
		renderer.domElement.setAttribute('role', 'img');
		renderer.domElement.setAttribute('aria-label', 'Animated 3D chart comparing monthly billed and collected revenue.');
		container.append(renderer.domElement);

		scene.add(new THREE.HemisphereLight(0xffffff, 0x8297a2, 2.2));
		const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
		keyLight.position.set(-5, 12, 8);
		scene.add(keyLight);
		const fillLight = new THREE.PointLight(0x65d6cb, 35, 24);
		fillLight.position.set(5, 7, -5);
		scene.add(fillLight);

		const chartGroup = new THREE.Group();
		scene.add(chartGroup);
		const grid = new THREE.GridHelper(17, 17, 0x93a8b4, 0xe1e9ed);
		grid.position.set(0, 0.02, 0);
		chartGroup.add(grid);

		const maxValue = Math.max(1, ...months.flatMap(month => [month.billed, month.received]));
		const scale = 5.5 / maxValue;
		const barGeometry = new THREE.BoxGeometry(0.32, 1, 0.42);
		const bars = [];

		months.forEach((month, index) => {
			const x = (index - (months.length - 1) / 2) * 1.32;
			[
				{ value: month.billed, color: 0x087b91, offset: -0.2 },
				{ value: month.received, color: 0x68b79c, offset: 0.2 }
			].forEach(series => {
				if (series.value <= 0) return;
				const height = Math.max(0.045, series.value * scale);
				const material = new THREE.MeshStandardMaterial({
					color: series.color,
					metalness: 0.18,
					roughness: 0.34,
					emissive: series.color,
					emissiveIntensity: 0.055
				});
				const bar = new THREE.Mesh(barGeometry, material);
				bar.position.set(x + series.offset, height / 2, 0);
				bar.scale.y = 0.001;
				bar.userData = { targetHeight: height, month: month.label, value: series.value, series: series.offset < 0 ? 'Billed' : 'Collected' };
				chartGroup.add(bar);
				bars.push(bar);
			});
		});

		const tooltip = container.parentElement.querySelector('.analytics-3d-tooltip');
		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		const onPointerMove = event => {
			const rect = renderer.domElement.getBoundingClientRect();
			pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
			raycaster.setFromCamera(pointer, camera);
			const hit = raycaster.intersectObjects(bars, false)[0];
			if (!tooltip) return;
			if (!hit) {
				tooltip.hidden = true;
				return;
			}
			tooltip.textContent = `${hit.object.userData.month} · ${hit.object.userData.series}: ৳ ${Number(hit.object.userData.value).toLocaleString('en-BD')}`;
			tooltip.hidden = false;
			tooltip.style.left = `${event.clientX - rect.left}px`;
			tooltip.style.top = `${event.clientY - rect.top}px`;
		};
		const onPointerLeave = () => { if (tooltip) tooltip.hidden = true; };
		renderer.domElement.addEventListener('pointermove', onPointerMove);
		renderer.domElement.addEventListener('pointerleave', onPointerLeave);

		let frame = 0;
		let animationId = 0;
		let lastTime = 0;
		const reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const resizeObserver = new ResizeObserver(([entry]) => {
			const width = Math.max(1, Math.floor(entry.contentRect.width));
			const height = Math.max(1, Math.floor(entry.contentRect.height));
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
			renderer.render(scene, camera);
		});
		resizeObserver.observe(container);

		function animate(time) {
			animationId = requestAnimationFrame(animate);
			const elapsed = Math.min(0.05, (time - (lastTime || time)) / 1000);
			lastTime = time;
			frame += elapsed;
			bars.forEach(bar => {
				const progress = reducedMotion ? 1 : Math.min(1, frame / 0.9);
				bar.scale.y = Math.max(0.001, progress) * bar.userData.targetHeight;
				bar.position.y = bar.scale.y / 2;
			});
			if (!reducedMotion) chartGroup.rotation.y = Math.sin(time * 0.00012) * 0.035;
			renderer.render(scene, camera);
		}
		animationId = requestAnimationFrame(animate);

		return () => {
			cancelAnimationFrame(animationId);
			resizeObserver.disconnect();
			renderer.domElement.removeEventListener('pointermove', onPointerMove);
			renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
			barGeometry.dispose();
			bars.forEach(bar => bar.material.dispose());
			renderer.dispose();
		};
	}

	root.HospitalAnalyticsVisuals = { mountRevenueChart };
})(typeof globalThis === 'object' ? globalThis : this);
