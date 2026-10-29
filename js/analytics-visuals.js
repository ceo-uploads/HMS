'use strict';

(function (root) {
	function mountRevenueChart(container, months, options = {}) {
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
		const zoom = Math.max(0.75, Math.min(1.5, Number(options.zoom) || 1));
		camera.position.set(0, 8.5, 17 / zoom);
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

		const mode = options.mode || 'revenue';
		const chartSeries = mode === 'rooms'
			? [{ key: 'roomCollected', label: 'Room collected', color: 0x087b91 }, { key: 'roomDue', label: 'Room due', color: 0xe7a447 }]
			: mode === 'activity'
				? [{ key: 'records', label: 'All records', color: 0x087b91 }, { key: 'appointments', label: 'Appointments', color: 0x68b79c }]
				: [{ key: 'billed', label: 'Billed', color: 0x087b91 }, { key: 'received', label: 'Collected', color: 0x68b79c }];
		const reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const animateMotion = options.motion !== false && !reducedMotion;
		const rotate = options.rotate !== false;
		const maxValue = Math.max(1, ...months.flatMap(month => chartSeries.map(series => Number(month[series.key]) || 0)));
		const scale = 5.5 / maxValue;
		const barGeometry = new THREE.BoxGeometry(0.32, 1, 0.42);
		const bars = [];

		months.forEach((month, index) => {
			const x = (index - (months.length - 1) / 2) * 1.32;
			chartSeries.forEach((series, seriesIndex) => {
				const value = Number(month[series.key]) || 0;
				if (value <= 0) return;
				const height = Math.max(0.045, value * scale);
				const material = new THREE.MeshStandardMaterial({
					color: series.color,
					metalness: 0.18,
					roughness: 0.34,
					emissive: series.color,
					emissiveIntensity: 0.055
				});
				const bar = new THREE.Mesh(barGeometry, material);
				bar.position.set(x + (seriesIndex === 0 ? -0.2 : 0.2), height / 2, 0);
				bar.scale.y = animateMotion ? 0.001 : height;
				bar.userData = { targetHeight: height, month: month.label, value, series: series.label };
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
				const progress = !animateMotion ? 1 : Math.min(1, frame / 0.9);
				bar.scale.y = Math.max(0.001, progress) * bar.userData.targetHeight;
				bar.position.y = bar.scale.y / 2;
			});
				if (animateMotion && rotate) chartGroup.rotation.y = Math.sin(time * 0.00012) * 0.035;
			renderer.render(scene, camera);
		}
			if (animateMotion) animationId = requestAnimationFrame(animate);
			else renderer.render(scene, camera);

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
